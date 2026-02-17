import { groupBy } from "lodash";
import { resolve as urlResolve } from "node:url";
import { JS_SOURCE_MAP_URL_COMMENT } from "../../../error-snippets/constants";
import { extractSourceFilesDeps, fetchTextWithBrowserFallback, isCachedOnFs, isDataProtocol } from "./utils";
import { CacheType, getCachedSelectivityFile, hasCachedSelectivityFile, setCachedSelectivityFile } from "./fs-cache";
import { debugSelectivity } from "./debug";
import type { CDP } from "..";
import type { DebuggerEvents } from "../domains/debugger";
import type { CDPRuntimeScriptId, CDPSessionId } from "../types";
import type { SelectivityAssetState } from "./types";

const SOURCE_CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"];

const isSourceCodeFile = (sourceFileName: string): boolean => {
    return SOURCE_CODE_EXTENSIONS.some(ext => sourceFileName.endsWith(ext));
};

export class JSSelectivity {
    private readonly _cdp: CDP;
    private readonly _sessionId: CDPSessionId;
    private readonly _sourceRoot: string;
    private _debuggerOnPausedFn: (() => void) | null = null;
    private _debuggerOnScriptParsedFn: ((params: DebuggerEvents["scriptParsed"]) => void) | null = null;
    private _scriptsSource: Record<CDPRuntimeScriptId, SelectivityAssetState> = {};
    private _scriptsSourceMap: Record<CDPRuntimeScriptId, SelectivityAssetState> = {};
    private _scriptIdToSourceUrl: Record<CDPRuntimeScriptId, string | null> = {};
    private _scriptIdToSourceMapUrl: Record<CDPRuntimeScriptId, string | null> = {};

    constructor(cdp: CDP, sessionId: CDPSessionId, sourceRoot = "") {
        this._cdp = cdp;
        this._sessionId = sessionId;
        this._sourceRoot = sourceRoot;
    }

    private _processScript({ scriptId, url, sourceMapURL }: DebuggerEvents["scriptParsed"]): void {
        if (!this._sessionId) {
            return;
        }

        this._scriptIdToSourceUrl[scriptId] ||= url;

        if (!url || !sourceMapURL) {
            this._scriptsSource[scriptId] ||= Promise.resolve(null);
            this._scriptsSourceMap[scriptId] ||= Promise.resolve(null);
            return;
        }

        this._scriptsSource[scriptId] ||= hasCachedSelectivityFile(CacheType.Asset, url).then(isCached => {
            return isCached
                ? true
                : this._cdp.debugger
                      .getScriptSource(this._sessionId, scriptId)
                      .then(res => res.scriptSource)
                      .then(data =>
                          setCachedSelectivityFile(CacheType.Asset, url, data)
                              .then(() => true as const)
                              .catch(err => {
                                  debugSelectivity(`Couldn't offload asset from "${url}" to fs-cache: %O`, err);
                                  return data;
                              }),
                      )
                      .catch((err: Error) => err);
        });

        const sourceMapResolvedUrl = urlResolve(url, sourceMapURL);

        // Embedded source maps are not cached on file system because of their large cache key
        if (isDataProtocol(sourceMapResolvedUrl)) {
            this._scriptIdToSourceMapUrl[scriptId] = null;
            this._scriptsSourceMap[scriptId] ||= fetchTextWithBrowserFallback(
                sourceMapResolvedUrl,
                this._cdp.runtime,
                this._sessionId,
            ).catch((err: Error) => err);
        } else {
            this._scriptIdToSourceMapUrl[scriptId] = sourceMapResolvedUrl;
            this._scriptsSourceMap[scriptId] ||= hasCachedSelectivityFile(CacheType.Asset, sourceMapResolvedUrl).then(
                isCached => {
                    return isCached
                        ? true
                        : fetchTextWithBrowserFallback(sourceMapResolvedUrl, this._cdp.runtime, this._sessionId)
                              .then(data =>
                                  setCachedSelectivityFile(CacheType.Asset, sourceMapResolvedUrl, data)
                                      .then(() => true as const)
                                      .catch(err => {
                                          debugSelectivity(
                                              `Couldn't offload asset from "${sourceMapResolvedUrl}" to fs-cache: %O`,
                                              err,
                                          );
                                          return data;
                                      }),
                              )
                              .catch((err: Error) => err);
                },
            );
        }
    }

    async start(): Promise<void> {
        const debuggerOnPaused = (this._debuggerOnPausedFn = async (): Promise<void> => {
            return this._cdp.debugger.resume(this._sessionId).catch(() => {});
        });

        const debuggerOnScriptParsedFn = (this._debuggerOnScriptParsedFn = this._processScript.bind(this));
        const sessionId = this._sessionId;

        this._cdp.debugger.on("paused", debuggerOnPaused);
        this._cdp.debugger.on("scriptParsed", debuggerOnScriptParsedFn);

        await Promise.all([
            this._cdp.target.setAutoAttach(sessionId, { autoAttach: true, waitForDebuggerOnStart: false }),
            this._cdp.debugger.enable(sessionId),
            this._cdp.profiler.enable(sessionId).then(() =>
                this._cdp.profiler.startPreciseCoverage(sessionId, {
                    callCount: false,
                    detailed: false,
                    allowTriggeredUpdates: false,
                }),
            ),
        ]);
    }

    /** @param drop only performs cleanup without providing actual deps. Should be "true" if test is failed */
    async stop(drop?: boolean): Promise<Set<string> | null> {
        try {
            if (drop) {
                return null;
            }

            const coverage = await this._cdp.profiler.takePreciseCoverage(this._sessionId);

            const scriptsWithUrl = coverage.result.filter(script => script.url);

            // If we haven't got "scriptParsed" event for the script, pull up source code + source map manually
            scriptsWithUrl.forEach(({ scriptId, url }) => {
                // Was processed with "this._processScript"
                if (Object.hasOwn(this._scriptsSource, scriptId) && Object.hasOwn(this._scriptsSourceMap, scriptId)) {
                    return;
                }

                // Not dropping sources to fs the end of test (when "stop" is called) because we use it immediately
                const scriptSourcePromise = this._cdp.debugger
                    .getScriptSource(this._sessionId, scriptId)
                    .then(({ scriptSource }) => {
                        setCachedSelectivityFile(CacheType.Asset, url, scriptSource).catch(() => {});
                        return scriptSource;
                    })
                    .catch((err: Error) => err);

                this._scriptIdToSourceUrl[scriptId] ||= url;
                this._scriptsSource[scriptId] ||= scriptSourcePromise;
                this._scriptsSourceMap[scriptId] ||= scriptSourcePromise.then(async sourceCode => {
                    if (sourceCode instanceof Error) {
                        return sourceCode;
                    }

                    const sourceMapsStartIndex = sourceCode.lastIndexOf(JS_SOURCE_MAP_URL_COMMENT);
                    const sourceMapsEndIndex = sourceCode.indexOf("\n", sourceMapsStartIndex);

                    // Source maps are not generated for this source file
                    if (sourceMapsStartIndex === -1) {
                        return null;
                    }

                    const sourceMapURL =
                        sourceMapsEndIndex === -1
                            ? sourceCode.slice(sourceMapsStartIndex + JS_SOURCE_MAP_URL_COMMENT.length)
                            : sourceCode.slice(
                                  sourceMapsStartIndex + JS_SOURCE_MAP_URL_COMMENT.length,
                                  sourceMapsEndIndex,
                              );

                    if (isDataProtocol(sourceMapURL)) {
                        return fetchTextWithBrowserFallback(sourceMapURL, this._cdp.runtime, this._sessionId).catch(
                            (err: Error) => err,
                        );
                    }

                    const resolvedSourceMapUrl = urlResolve(url, sourceMapURL);

                    this._scriptIdToSourceMapUrl[scriptId] ||= resolvedSourceMapUrl;

                    try {
                        const cachedSourceMaps = await getCachedSelectivityFile(CacheType.Asset, resolvedSourceMapUrl);

                        if (cachedSourceMaps) {
                            return cachedSourceMaps;
                        }

                        const sourceMap = await fetchTextWithBrowserFallback(
                            resolvedSourceMapUrl,
                            this._cdp.runtime,
                            this._sessionId,
                        );

                        setCachedSelectivityFile(CacheType.Asset, resolvedSourceMapUrl, sourceMap).catch(() => {});

                        return sourceMap;
                    } catch (err) {
                        return err as Error;
                    }
                });
            });

            const totalDependingSourceFiles = new Set<string>();
            const grouppedByScriptCoverage = groupBy(coverage.result, "scriptId");
            const scriptIds = Object.keys(grouppedByScriptCoverage);

            await Promise.all(
                scriptIds.map(async scriptId => {
                    const [source, sourceMaps] = await Promise.all([
                        this._scriptsSource[scriptId],
                        this._scriptsSourceMap[scriptId],
                    ]);
                    const sourceMapUrl = this._scriptIdToSourceMapUrl[scriptId];
                    // Every "scriptId" has only one uniq "url"
                    const sourceUrl = this._scriptIdToSourceUrl[scriptId] || grouppedByScriptCoverage[scriptId][0].url;

                    // Function was called, but source maps were not generated for the file
                    // Or its anonymous script, without source url
                    if (!source || !sourceMaps || !sourceUrl) {
                        return;
                    }

                    if (source instanceof Error) {
                        throw new Error(`JS Selectivity: Couldn't load source code from ${sourceUrl}`, {
                            cause: source,
                        });
                    }

                    if (sourceMaps instanceof Error) {
                        throw new Error(`JS Selectivity: Couldn't load source maps from ${sourceMapUrl}`, {
                            cause: sourceMaps,
                        });
                    }

                    if (isCachedOnFs(sourceMaps) && !sourceMapUrl) {
                        throw new Error(
                            "Assertation failed: souce map url has to present if source maps are fs-cached",
                        );
                    }

                    const sourceString = isCachedOnFs(source)
                        ? await getCachedSelectivityFile(CacheType.Asset, sourceUrl)
                        : source;
                    const sourceMapsString = isCachedOnFs(sourceMaps)
                        ? await getCachedSelectivityFile(CacheType.Asset, sourceMapUrl as string)
                        : sourceMaps;

                    if (!sourceString || !sourceMapsString) {
                        throw new Error(`JS Selectivity: fs-cache is broken for ${sourceUrl}`);
                    }

                    const startOffsetsSet = new Set<number>();

                    grouppedByScriptCoverage[scriptId].forEach(entry => {
                        entry.functions.forEach(fn => {
                            fn.ranges.forEach(range => {
                                startOffsetsSet.add(range.startOffset);
                            });
                        });
                    });

                    const dependingSourceFiles = await extractSourceFilesDeps(
                        sourceString,
                        sourceMapsString,
                        Array.from(startOffsetsSet),
                        this._sourceRoot,
                    );

                    for (const sourceFile of dependingSourceFiles.values()) {
                        if (isSourceCodeFile(sourceFile)) {
                            totalDependingSourceFiles.add(sourceFile);
                        }
                    }
                }),
            );

            return totalDependingSourceFiles;
        } finally {
            this._debuggerOnPausedFn && this._cdp.debugger.off("paused", this._debuggerOnPausedFn);
            this._debuggerOnScriptParsedFn && this._cdp.debugger.off("scriptParsed", this._debuggerOnScriptParsedFn);
        }
    }
}
