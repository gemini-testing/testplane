import { groupBy } from "lodash";
import { resolve as urlResolve } from "node:url";
import { JS_SOURCE_MAP_URL_COMMENT } from "../../../error-snippets/constants";
import {
    extractSourceFilesDeps,
    fetchTextWithBrowserFallback,
    isCachedOnFs,
    isDataProtocol,
    parseSourceMapRanges,
} from "./utils";
import { CacheType, getCachedSelectivityFile, hasCachedSelectivityFile, setCachedSelectivityFile } from "./fs-cache";
import { debugSelectivity } from "./debug";
import type { CDP } from "..";
import type { DebuggerEvents } from "../domains/debugger";
import type { CDPRuntimeScriptId, CDPScriptCoverage, CDPSessionId } from "../types";
import type { SelectivityAssetState } from "./types";
import type { SelectivityMapSourceMapUrlFn } from "../../../config/types";

const SOURCE_CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"];

const PRECISE_COVERAGE_PARAMS = { callCount: false, detailed: false, allowTriggeredUpdates: false } as const;

const isSourceCodeFile = (sourceFileName: string): boolean => {
    return SOURCE_CODE_EXTENSIONS.some(ext => sourceFileName.endsWith(ext));
};

/**
 * CDP "scriptId" is NOT stable across a test: it is reused for different scripts over time (a cross-process
 * navigation restarts the counter; bfcache restore re-issues the previous document's ids; freed ids get reassigned
 * to new scripts). "Profiler.takePreciseCoverage" reports only the raw "scriptId", with no way to tell which script
 * a given id currently means. Therefore coverage can only be attributed correctly if it is resolved WHILE the
 * scripts are still live and the "scriptId -> source" mapping is current.
 *
 * The orchestration in index.ts pauses the renderer at two boundaries and drives this class:
 *  - on "beforeunload": takeCoverageSnapshot() — resolve the leaving page while its isolate is still alive
 *    (required for cross-process navigation, where the old isolate is gone by the time the next document starts);
 *  - at the new document start (and bfcache "pageshow"): flushPage() — resolve whatever is left of the previous
 *    page (same-process, incl. code that ran during unload), then RESET precise coverage and CLEAR the script maps
 *    so the next page parses into an empty map and its coverage window cannot mix with the previous page's.
 * Because the maps are cleared at every page boundary, plain "scriptId" keys are unambiguous within a page.
 */
export class JSSelectivity {
    private readonly _cdp: CDP;
    private readonly _sessionId: CDPSessionId;
    private readonly _sourceRoot: string;
    private readonly _mapSourceMapUrl: SelectivityMapSourceMapUrlFn | null;
    private _debuggerOnScriptParsedFn:
        | ((params: DebuggerEvents["scriptParsed"], cdpSessionId?: CDPSessionId) => void)
        | null = null;
    private _scriptsSource: Record<CDPRuntimeScriptId, SelectivityAssetState> = {};
    private _scriptsSourceMap: Record<CDPRuntimeScriptId, SelectivityAssetState> = {};
    private _scriptIdToSourceUrl: Record<CDPRuntimeScriptId, string | null> = {};
    private _scriptIdToSourceMapUrl: Record<CDPRuntimeScriptId, string | null> = {};
    /** Last seen content hash per "scriptId" — used to detect a "scriptId" reused for a different script */
    private _scriptIdToHash: Record<CDPRuntimeScriptId, string> = {};
    /** Source files collected across all pages of the current test */
    private readonly _dependingSourceFiles = new Set<string>();

    constructor(
        cdp: CDP,
        sessionId: CDPSessionId,
        sourceRoot: string,
        mapSourceMapUrl: SelectivityMapSourceMapUrlFn | null,
    ) {
        this._cdp = cdp;
        this._sessionId = sessionId;
        this._sourceRoot = sourceRoot;
        this._mapSourceMapUrl = mapSourceMapUrl;
    }

    private _processScript(
        { scriptId, url, sourceMapURL, hash }: DebuggerEvents["scriptParsed"],
        cdpSessionId?: CDPSessionId,
    ): void {
        if (!this._sessionId || cdpSessionId !== this._sessionId) {
            return;
        }

        // A "scriptId" can be reused for a DIFFERENT script within a single page window (a cross-process forward
        // navigation may restart ids before the next boundary clears the maps). Detect reuse by content hash and drop
        // the now-stale mapping, so the "||=" below repopulates it for the new script instead of keeping the old one.
        const previousHash = this._scriptIdToHash[scriptId];

        if (previousHash !== undefined && previousHash !== hash) {
            delete this._scriptsSource[scriptId];
            delete this._scriptsSourceMap[scriptId];
            delete this._scriptIdToSourceUrl[scriptId];
            delete this._scriptIdToSourceMapUrl[scriptId];
        }

        this._scriptIdToHash[scriptId] = hash;

        this._scriptIdToSourceUrl[scriptId] ||= url;

        if (!url || !sourceMapURL || url.startsWith("chrome-error://")) {
            this._scriptsSource[scriptId] ||= null;
            this._scriptsSourceMap[scriptId] ||= null;
            return;
        }

        if (this._scriptsSource[scriptId] && this._scriptsSourceMap[scriptId]) {
            return;
        }

        let sourceMapResolvedUrl = urlResolve(url, sourceMapURL);

        const mapResult = this._mapSourceMapUrl
            ? this._mapSourceMapUrl({ type: "js", sourceUrl: url, sourceMapUrl: sourceMapResolvedUrl })
            : true;

        if (!mapResult) {
            this._scriptsSource[scriptId] ||= null;
            this._scriptsSourceMap[scriptId] ||= null;
            return;
        }

        if (mapResult !== true) {
            this._scriptIdToSourceMapUrl[scriptId] = sourceMapResolvedUrl = mapResult;
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

    // If we haven't got "scriptParsed" event for the script, pull up source code + source map manually
    private _ensureScriptsAreLoading(coverage: CDPScriptCoverage[]): void {
        coverage.forEach(({ scriptId, url }) => {
            const fixedUrl = url || this._scriptIdToSourceUrl[scriptId];
            const wasProcessed =
                Object.hasOwn(this._scriptsSource, scriptId) && Object.hasOwn(this._scriptsSourceMap, scriptId);
            const isAnonymous = !fixedUrl;
            const urlWasCorrected = url && url !== this._scriptIdToSourceUrl[scriptId];
            const shouldRecalculateSource = Boolean(urlWasCorrected && this._mapSourceMapUrl);

            if ((wasProcessed && !shouldRecalculateSource) || isAnonymous) {
                return;
            }

            // Not dropping sources to fs the end of test (when "stop" is called) because we use it immediately
            const scriptSourcePromise = (async (): Promise<string | Error> => {
                const currentValue = await this._scriptsSource[scriptId];
                const cacheResolvedValue = isCachedOnFs(currentValue)
                    ? await getCachedSelectivityFile(CacheType.Asset, fixedUrl)
                    : currentValue;

                if (cacheResolvedValue && typeof cacheResolvedValue === "string") {
                    return cacheResolvedValue;
                }

                return this._cdp.debugger
                    .getScriptSource(this._sessionId, scriptId)
                    .then(({ scriptSource }) => {
                        setCachedSelectivityFile(CacheType.Asset, fixedUrl, scriptSource).catch(() => {});
                        return scriptSource;
                    })
                    .catch((err: Error) => err);
            })();

            this._scriptIdToSourceUrl[scriptId] ||= url;
            this._scriptsSource[scriptId] ||= scriptSourcePromise;

            if (!this._scriptsSourceMap[scriptId] || shouldRecalculateSource) {
                this._scriptsSourceMap[scriptId] = scriptSourcePromise.then(async sourceCode => {
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

                    let resolvedSourceMapUrl = urlResolve(fixedUrl, sourceMapURL);

                    const mappedResult = this._mapSourceMapUrl
                        ? this._mapSourceMapUrl({ type: "js", sourceUrl: fixedUrl, sourceMapUrl: resolvedSourceMapUrl })
                        : true;

                    if (!mappedResult) {
                        this._scriptsSource[scriptId] = null;
                        return null;
                    }

                    if (mappedResult !== true) {
                        this._scriptIdToSourceMapUrl[scriptId] = resolvedSourceMapUrl = mappedResult;
                    } else {
                        this._scriptIdToSourceMapUrl[scriptId] ||= resolvedSourceMapUrl;
                    }

                    if (isDataProtocol(resolvedSourceMapUrl)) {
                        return fetchTextWithBrowserFallback(
                            resolvedSourceMapUrl,
                            this._cdp.runtime,
                            this._sessionId,
                        ).catch((err: Error) => err);
                    }

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
            }
        });
    }

    private async _waitForLoadingScripts(): Promise<void> {
        await Promise.all([
            Promise.allSettled(Object.values(this._scriptsSource)),
            Promise.allSettled(Object.values(this._scriptsSourceMap)),
        ]);
    }

    /**
     * Resolves the given coverage into original source files and accumulates them into "_dependingSourceFiles".
     * Must run while the "scriptId -> source" maps still describe the scripts the coverage was taken from
     * (i.e. before the page is navigated away and the maps are cleared).
     */
    private async _resolveCoverageToDeps(coverageScripts: CDPScriptCoverage[]): Promise<void> {
        const grouppedByScriptCoverage = groupBy(coverageScripts, "scriptId");
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
                    throw new Error(
                        [`JS Selectivity: Couldn't load source code from ${sourceUrl}:`, String(source)].join("\n"),
                    );
                }

                if (sourceMaps instanceof Error) {
                    throw new Error(
                        [`JS Selectivity: Couldn't load source maps from ${sourceMapUrl}`, String(sourceMaps)].join(
                            "\n",
                        ),
                    );
                }

                if (isCachedOnFs(sourceMaps) && !sourceMapUrl) {
                    throw new Error("Assertation failed: souce map url has to present if source maps are fs-cached");
                }

                const [sourceString, sourceMapsString] = await Promise.all([
                    isCachedOnFs(source) ? getCachedSelectivityFile(CacheType.Asset, sourceUrl) : source,
                    isCachedOnFs(sourceMaps)
                        ? getCachedSelectivityFile(CacheType.Asset, sourceMapUrl as string)
                        : sourceMaps,
                ]);

                if (!sourceString || !sourceMapsString) {
                    throw new Error(`JS Selectivity: fs-cache is broken for ${sourceUrl}`);
                }

                const parsedSourceMapRanges = await parseSourceMapRanges(
                    sourceString,
                    sourceMapsString,
                    this._sourceRoot,
                );
                const dependingSourceFiles = extractSourceFilesDeps(
                    parsedSourceMapRanges,
                    grouppedByScriptCoverage[scriptId],
                    isSourceCodeFile,
                );

                for (const sourceFile of dependingSourceFiles.values()) {
                    this._dependingSourceFiles.add(sourceFile);
                }
            }),
        );
    }

    async start(): Promise<void> {
        const debuggerOnScriptParsedFn = (this._debuggerOnScriptParsedFn = this._processScript.bind(this));
        const sessionId = this._sessionId;

        this._cdp.debugger.on("scriptParsed", debuggerOnScriptParsedFn);

        await this._cdp.profiler.startPreciseCoverage(sessionId, PRECISE_COVERAGE_PARAMS);
    }

    /**
     * Called on "beforeunload", while the leaving page is still alive (its isolate not yet destroyed). Resolves the
     * page's coverage into dependencies. Does NOT reset coverage or clear maps — that happens later, at the next
     * page boundary (flushPage), once the leaving page has fully finished executing.
     */
    async takeCoverageSnapshot(): Promise<void> {
        const coveragePart = await this._cdp.profiler.takePreciseCoverage(this._sessionId);

        this._ensureScriptsAreLoading(coveragePart.result);

        await this._waitForLoadingScripts();

        // Missing a dependency is worse than failing the test, so resolution errors are propagated (and turned into a
        // test failure by the orchestrator in index.ts), never swallowed into a partial dump.
        await this._resolveCoverageToDeps(coveragePart.result);
    }

    /**
     * Called at a page boundary — the new document's start, and on bfcache "pageshow" — while the renderer is paused
     * before the incoming page's scripts run. Resolves whatever is left of the previous page (same-process code that
     * ran during unload), then RESETS precise coverage and CLEARS the script maps. This guarantees the next page's
     * coverage window and "scriptId" namespace start empty, so reused ids cannot be mistaken for the previous page's.
     */
    async flushPage(): Promise<void> {
        const coveragePart = await this._cdp.profiler.takePreciseCoverage(this._sessionId);

        this._ensureScriptsAreLoading(coveragePart.result);

        await this._waitForLoadingScripts();

        // Missing a dependency is worse than failing the test, so resolution and coverage-reset errors are
        // propagated (turned into a test failure by index.ts), never swallowed into a partial dump.
        await this._resolveCoverageToDeps(coveragePart.result);

        // Reset coverage so the next page's window starts empty (a persisting same-process isolate would otherwise
        // keep re-reporting this page's scripts under ids that the next page reuses).
        await this._cdp.profiler.stopPreciseCoverage(this._sessionId);
        await this._cdp.profiler.startPreciseCoverage(this._sessionId, PRECISE_COVERAGE_PARAMS);

        // Clear the script maps so the next page parses into an empty namespace and reused "scriptId"s can't hit a
        // stale mapping from the previous page.
        this._scriptsSource = {};
        this._scriptsSourceMap = {};
        this._scriptIdToSourceUrl = {};
        this._scriptIdToSourceMapUrl = {};
        this._scriptIdToHash = {};
    }

    /** @param drop only performs cleanup without providing actual deps. Should be "true" if test is failed */
    async stop(drop?: boolean): Promise<Set<string> | null> {
        try {
            if (drop) {
                return null;
            }

            const coverageLastPart = await this._cdp.profiler.takePreciseCoverage(this._sessionId);

            this._ensureScriptsAreLoading(coverageLastPart.result);

            await this._waitForLoadingScripts();

            await this._resolveCoverageToDeps(coverageLastPart.result);

            return this._dependingSourceFiles;
        } finally {
            this._debuggerOnScriptParsedFn && this._cdp.debugger.off("scriptParsed", this._debuggerOnScriptParsedFn);
        }
    }
}
