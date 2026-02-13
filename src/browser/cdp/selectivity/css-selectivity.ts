import { groupBy } from "lodash";
import path from "node:path";
import { resolve as urlResolve } from "node:url";
import { CSS_SOURCE_MAP_URL_COMMENT } from "../../../error-snippets/constants";
import {
    fetchTextWithBrowserFallback,
    hasProtocol,
    isCachedOnFs,
    isDataProtocol,
    patchSourceMapSources,
} from "./utils";
import { CacheType, getCachedSelectivityFile, hasCachedSelectivityFile, setCachedSelectivityFile } from "./fs-cache";
import { debugSelectivity } from "./debug";
import type { CDP } from "..";
import type { CDPStyleSheetId, CDPSessionId } from "../types";
import type { CssEvents } from "../domains/css";
import type { SelectivityAssetState } from "./types";

export class CSSSelectivity {
    private readonly _cdp: CDP;
    private readonly _sessionId: CDPSessionId;
    private readonly _sourceRoot: string;
    private _cssOnStyleSheetAddedFn: ((params: CssEvents["styleSheetAdded"]) => void) | null = null;
    private _stylesSourceMap: Record<CDPStyleSheetId, SelectivityAssetState> = {};
    private _styleSheetIdToSourceMapUrl: Record<CDPStyleSheetId, string | null> = {};

    constructor(cdp: CDP, sessionId: CDPSessionId, sourceRoot = "") {
        this._cdp = cdp;
        this._sessionId = sessionId;
        this._sourceRoot = sourceRoot;
    }

    private _processStyle({ header: { styleSheetId, sourceURL, sourceMapURL } }: CssEvents["styleSheetAdded"]): void {
        if (!this._sessionId) {
            return;
        }

        if (!sourceURL || !sourceMapURL) {
            this._stylesSourceMap[styleSheetId] ||= Promise.resolve(null);
            return;
        }

        const sourceMapResolvedUrl = urlResolve(sourceURL, sourceMapURL);

        // Embedded source maps are not cached on file system because of their large cache key
        if (isDataProtocol(sourceMapResolvedUrl)) {
            this._styleSheetIdToSourceMapUrl[styleSheetId] = null;
            this._stylesSourceMap[styleSheetId] ||= fetchTextWithBrowserFallback(
                sourceMapResolvedUrl,
                this._cdp.runtime,
                this._sessionId,
            ).catch((err: Error) => err);
        } else {
            this._styleSheetIdToSourceMapUrl[styleSheetId] = sourceMapResolvedUrl;
            this._stylesSourceMap[styleSheetId] ||= hasCachedSelectivityFile(
                CacheType.Asset,
                sourceMapResolvedUrl,
            ).then(isCached => {
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
            });
        }
    }

    async start(): Promise<void> {
        const cssOnStyleSheetAdded = (this._cssOnStyleSheetAddedFn = this._processStyle.bind(this));

        this._cdp.css.on("styleSheetAdded", cssOnStyleSheetAdded);

        await Promise.all([
            this._cdp.target.setAutoAttach(this._sessionId, { autoAttach: true, waitForDebuggerOnStart: false }),
            this._cdp.dom
                .enable(this._sessionId)
                .then(() => this._cdp.css.enable(this._sessionId))
                .then(() => this._cdp.css.startRuleUsageTracking(this._sessionId)),
        ]);
    }

    /** @param drop only performs cleanup without providing actual deps. Should be "true" if test is failed */
    async stop(drop?: boolean): Promise<Set<string> | null> {
        try {
            if (drop) {
                return null;
            }

            const coverage = await this._cdp.css.stopRuleUsageTracking(this._sessionId);

            // If we haven't got "styleSheetAdded" event for the script, pull up styles + source map manually
            coverage.ruleUsage.forEach(({ styleSheetId }) => {
                if (Object.hasOwn(this._stylesSourceMap, styleSheetId)) {
                    return;
                }

                const scriptSourcePromise = this._cdp.css
                    .getStyleSheetText(this._sessionId, styleSheetId)
                    .then(res => res.text)
                    .catch((err: Error) => err);

                this._stylesSourceMap[styleSheetId] ||= scriptSourcePromise.then(sourceCode => {
                    if (sourceCode instanceof Error) {
                        return sourceCode;
                    }

                    const sourceMapsStartIndex = sourceCode.lastIndexOf(CSS_SOURCE_MAP_URL_COMMENT);
                    const sourceMapsEndIndex = sourceCode.indexOf("*/", sourceMapsStartIndex);

                    // Source maps are not generated for this source file
                    if (sourceMapsStartIndex === -1) {
                        return null;
                    }

                    const sourceMapURL =
                        sourceMapsEndIndex === -1
                            ? sourceCode.slice(sourceMapsStartIndex + CSS_SOURCE_MAP_URL_COMMENT.length)
                            : sourceCode.slice(
                                  sourceMapsStartIndex + CSS_SOURCE_MAP_URL_COMMENT.length,
                                  sourceMapsEndIndex,
                              );

                    // If we encounter css stylesheet, that was not reported by "styleSheetAdded"
                    // We can only get sourcemaps if they are inlined
                    // Otherwise, we can't resolve actual sourcemaps url because we dont know css styles url itself.
                    if (!isDataProtocol(sourceMapURL)) {
                        return new Error(
                            [
                                `Missed stylesheet url for stylesheet id ${styleSheetId}.`,
                                "Looks like Chrome Devtools 'styleSheetAdded' event was lost",
                                "It could happen due to network instability",
                                "Switching to inline sourcemaps for CSS will help at the cost of increased RAM usage",
                            ].join("\n"),
                        );
                    }

                    return fetchTextWithBrowserFallback(sourceMapURL, this._cdp.runtime, this._sessionId).catch(
                        (err: Error) => err,
                    );
                });
            });

            const totalDependingSourceFiles = new Set<string>();
            const grouppedByStyleSheetCoverage = groupBy(coverage.ruleUsage, "styleSheetId");
            const styleSheetIds = Object.keys(grouppedByStyleSheetCoverage);

            await Promise.all(
                styleSheetIds.map(async styleSheetId => {
                    const sourceMap = await this._stylesSourceMap[styleSheetId];
                    const sourceMapUrl = this._styleSheetIdToSourceMapUrl[styleSheetId];

                    if (!sourceMap) {
                        return;
                    }

                    if (sourceMap instanceof Error) {
                        throw new Error(
                            `CSS Selectivity: Couldn't load source maps for stylesheet id ${styleSheetId}`,
                            { cause: sourceMap },
                        );
                    }

                    if (isCachedOnFs(sourceMap) && !sourceMapUrl) {
                        throw new Error(
                            "Assertation failed: souce map url has to present if source maps are fs-cached",
                        );
                    }

                    const sourceMapString = isCachedOnFs(sourceMap)
                        ? await getCachedSelectivityFile(CacheType.Asset, sourceMapUrl as string)
                        : sourceMap;

                    if (!sourceMapString) {
                        throw new Error(`CSS Selectivity: fs-cache is broken for ${sourceMapUrl}`);
                    }

                    const rawSourceMap = patchSourceMapSources(JSON.parse(sourceMapString), this._sourceRoot);

                    // We could check "if stylesheet was used" with utils.extractSourceFilesDeps
                    // But we dont, because if stylesheet was not used, it could be used after change
                    // So its safe to think "if stylesheet was loaded, it was used"
                    rawSourceMap.sources.forEach(sourceFilePath => {
                        // "Each entry is either a string that is a (potentially relative) URL", so we are using posix.jojn
                        // https://tc39.es/ecma426/#sec-source-map-format
                        // Except for file path with protocol ("turbopack://", "file://")
                        const sourceRootBasedPath = hasProtocol(sourceFilePath)
                            ? sourceFilePath
                            : path.posix.join(rawSourceMap.sourceRoot || "", sourceFilePath);

                        totalDependingSourceFiles.add(sourceRootBasedPath);
                    });
                }),
            );

            return totalDependingSourceFiles;
        } finally {
            this._cssOnStyleSheetAddedFn && this._cdp.css.off("styleSheetAdded", this._cssOnStyleSheetAddedFn);
        }
    }
}
