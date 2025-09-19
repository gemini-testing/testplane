import { groupBy } from "lodash";
import { resolve as urlResolve } from "node:url";
import type { CDP } from "..";
import type { DebuggerEvents } from "../domains/debugger";
import type { CDPRuntimeScriptId, CDPSessionId } from "../types";
import { JS_SOURCE_MAP_URL_COMMENT } from "../../../error-snippets/constants";
import { extractSourceFilesDeps, fetchTextWithBrowserFallback } from "./utils";

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
    private _scriptsSource: Record<CDPRuntimeScriptId, null | Promise<string | Error>> = {};
    private _scriptsSourceMap: Record<CDPRuntimeScriptId, null | Promise<string | Error>> = {};

    constructor(cdp: CDP, sessionId: CDPSessionId, sourceRoot = "") {
        this._cdp = cdp;
        this._sessionId = sessionId;
        this._sourceRoot = sourceRoot;
    }

    private _processScript({ scriptId, url, sourceMapURL }: DebuggerEvents["scriptParsed"]): void {
        if (!this._sessionId) {
            return;
        }

        if (!url || !sourceMapURL) {
            this._scriptsSource[scriptId] ||= null;
            this._scriptsSourceMap[scriptId] ||= null;
            return;
        }

        this._scriptsSource[scriptId] ||= this._cdp.debugger
            .getScriptSource(this._sessionId, scriptId)
            .then(res => res.scriptSource)
            .catch((err: Error) => err);

        this._scriptsSourceMap[scriptId] ||= fetchTextWithBrowserFallback(
            urlResolve(url, sourceMapURL),
            this._cdp.runtime,
            this._sessionId,
        );
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
    async stop(drop?: boolean): Promise<string[]> {
        if (drop) {
            this._debuggerOnPausedFn && this._cdp.debugger.off("paused", this._debuggerOnPausedFn);
            this._debuggerOnScriptParsedFn && this._cdp.debugger.off("scriptParsed", this._debuggerOnScriptParsedFn);

            return [];
        }

        const coverage = await this._cdp.profiler.takePreciseCoverage(this._sessionId);

        const scriptsWithUrl = coverage.result.filter(script => script.url);

        // If we haven't got "scriptParsed" event for the script, pull up source code + source map manually
        scriptsWithUrl.forEach(({ scriptId, url }) => {
            if (Object.hasOwn(this._scriptsSource, scriptId) && Object.hasOwn(this._scriptsSourceMap, scriptId)) {
                return;
            }

            const scriptSourcePromise = this._cdp.debugger
                .getScriptSource(this._sessionId, scriptId)
                .then(res => res.scriptSource)
                .catch((err: Error) => err);

            this._scriptsSource[scriptId] ||= scriptSourcePromise;
            this._scriptsSourceMap[scriptId] ||= scriptSourcePromise.then(sourceCode => {
                if (sourceCode instanceof Error) {
                    return sourceCode;
                }

                const sourceMapsStartIndex = sourceCode.lastIndexOf(JS_SOURCE_MAP_URL_COMMENT);
                const sourceMapsEndIndex = sourceCode.indexOf("\n", sourceMapsStartIndex);

                if (sourceMapsStartIndex === -1) {
                    return new Error("Source maping url comment is missing");
                }

                const sourceMapURL =
                    sourceMapsEndIndex === -1
                        ? sourceCode.slice(sourceMapsStartIndex + JS_SOURCE_MAP_URL_COMMENT.length)
                        : sourceCode.slice(sourceMapsStartIndex + JS_SOURCE_MAP_URL_COMMENT.length, sourceMapsEndIndex);

                return fetchTextWithBrowserFallback(urlResolve(url, sourceMapURL), this._cdp.runtime, this._sessionId);
            });
        });

        const totalDependingSourceFiles = new Set<string>();
        const grouppedByScriptCoverage = groupBy(coverage.result, "scriptId");
        const scriptIds = Object.keys(grouppedByScriptCoverage);

        await Promise.all(
            scriptIds.map(async scriptId => {
                // Every "scriptId" has only one uniq "url"
                const url = grouppedByScriptCoverage[scriptId][0].url;
                const [source, sourceMaps] = await Promise.all([
                    this._scriptsSource[scriptId],
                    this._scriptsSourceMap[scriptId],
                ]);

                if (!source || !sourceMaps) {
                    return;
                }

                if (source instanceof Error) {
                    throw new Error(`JS Selectivity: Couldn't load source code at ${url}: ${source}`);
                }

                if (sourceMaps instanceof Error) {
                    throw new Error(`JS Selectivity: Couldn't load source maps of ${url}: ${sourceMaps}`);
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
                    source,
                    sourceMaps,
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

        this._debuggerOnPausedFn && this._cdp.debugger.off("paused", this._debuggerOnPausedFn);
        this._debuggerOnScriptParsedFn && this._cdp.debugger.off("scriptParsed", this._debuggerOnScriptParsedFn);

        return Array.from(totalDependingSourceFiles).sort();
    }
}
