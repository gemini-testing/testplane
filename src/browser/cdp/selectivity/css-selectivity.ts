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
import type { CssEvents, CSSRuleUsage } from "../domains/css";
import type { SelectivityAssetState } from "./types";
import type { SelectivityMapSourceMapUrlFn } from "../../../config/types";

interface CssSessionCache
    extends Record<
        CDPStyleSheetId,
        {
            sourceMap: Exclude<Awaited<SelectivityAssetState>, Error>;
            sourceMapUrl: string | null;
            isError: boolean;
        }
    > {}

export class CSSSelectivity {
    private readonly _cdp: CDP;
    private readonly _cdpSessionId: CDPSessionId;
    private readonly _wdSessionId: string;
    private readonly _sourceRoot: string;
    private readonly _mapSourceMapUrl: SelectivityMapSourceMapUrlFn | null;
    private _cssOnStyleSheetAddedFn:
        | ((params: CssEvents["styleSheetAdded"], cdpSessionId?: CDPSessionId) => void)
        | null = null;
    private readonly _stylesSourceMap: Record<CDPStyleSheetId, SelectivityAssetState> = {};
    private readonly _styleSheetIdToSourceMapUrl: Record<CDPStyleSheetId, string | null> = {};
    private readonly _coverageResult: CSSRuleUsage[] = [];

    constructor(
        cdp: CDP,
        cdpSessionId: CDPSessionId,
        wdSessionId: string,
        sourceRoot: string,
        mapSourceMapUrl: SelectivityMapSourceMapUrlFn | null,
    ) {
        this._cdp = cdp;
        this._cdpSessionId = cdpSessionId;
        this._wdSessionId = wdSessionId;
        this._sourceRoot = sourceRoot;
        this._mapSourceMapUrl = mapSourceMapUrl;
    }

    private _processStyle(
        { header: { styleSheetId, sourceURL, sourceMapURL } }: CssEvents["styleSheetAdded"],
        cdpSessionId?: CDPSessionId,
    ): void {
        if (!this._cdpSessionId || cdpSessionId !== this._cdpSessionId) {
            return;
        }

        if (!sourceURL || !sourceMapURL) {
            this._stylesSourceMap[styleSheetId] ||= null;
            return;
        }

        if (this._stylesSourceMap[styleSheetId]) {
            return;
        }

        let sourceMapResolvedUrl = urlResolve(sourceURL, sourceMapURL);

        const mapResult = this._mapSourceMapUrl
            ? this._mapSourceMapUrl({ type: "css", sourceUrl: sourceURL, sourceMapUrl: sourceMapResolvedUrl })
            : true;

        if (!mapResult) {
            this._stylesSourceMap[styleSheetId] ||= null;
            return;
        }

        if (mapResult !== true) {
            this._styleSheetIdToSourceMapUrl[styleSheetId] = sourceMapResolvedUrl = mapResult;
        }

        // Embedded source maps are not cached on file system because of their large cache key
        if (isDataProtocol(sourceMapResolvedUrl)) {
            this._styleSheetIdToSourceMapUrl[styleSheetId] = null;
            this._stylesSourceMap[styleSheetId] ||= fetchTextWithBrowserFallback(
                sourceMapResolvedUrl,
                this._cdp.runtime,
                this._cdpSessionId,
            ).catch((err: Error) => err);
        } else {
            this._styleSheetIdToSourceMapUrl[styleSheetId] = sourceMapResolvedUrl;
            this._stylesSourceMap[styleSheetId] ||= hasCachedSelectivityFile(
                CacheType.Asset,
                sourceMapResolvedUrl,
            ).then(isCached => {
                return isCached
                    ? true
                    : fetchTextWithBrowserFallback(sourceMapResolvedUrl, this._cdp.runtime, this._cdpSessionId)
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

    // If we haven't got "styleSheetAdded" event for the script, pull up styles + source map manually
    private _ensureStylesAreLoading(ruleUsage: CSSRuleUsage[]): void {
        ruleUsage.forEach(({ styleSheetId }) => {
            if (Object.hasOwn(this._stylesSourceMap, styleSheetId)) {
                return;
            }

            this._stylesSourceMap[styleSheetId] ||= (async (): Promise<string | Error | null> => {
                // In case SourceMapUrl was restored from session-cache, but SourceMap itself wasn't
                if (this._styleSheetIdToSourceMapUrl[styleSheetId]) {
                    const sourceMapUrl = this._styleSheetIdToSourceMapUrl[styleSheetId] as string;
                    const cachedSourceMap = await getCachedSelectivityFile(CacheType.Asset, sourceMapUrl);

                    if (cachedSourceMap) {
                        return cachedSourceMap;
                    }

                    const sourceMap = await fetchTextWithBrowserFallback(
                        sourceMapUrl,
                        this._cdp.runtime,
                        this._cdpSessionId,
                    ).catch((err: Error) => err);

                    if (!(sourceMap instanceof Error)) {
                        setCachedSelectivityFile(CacheType.Asset, sourceMapUrl, sourceMap).catch(() => {});
                    }

                    return sourceMap;
                }

                const sourceCode = await this._cdp.css
                    .getStyleSheetText(this._cdpSessionId, styleSheetId)
                    .then(res => res.text)
                    .catch((err: Error) => err);

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

                return fetchTextWithBrowserFallback(sourceMapURL, this._cdp.runtime, this._cdpSessionId).catch(
                    (err: Error) => err,
                );
            })();
        });
    }

    private async _waitForLoadingStyles(): Promise<void> {
        await Promise.allSettled(Object.values(this._stylesSourceMap));
    }

    private async _saveSessionCache(): Promise<void> {
        const sessionCache: CssSessionCache = {};

        for (const styleSheetId in this._styleSheetIdToSourceMapUrl) {
            const sourceMapUrl = this._styleSheetIdToSourceMapUrl[styleSheetId];
            const sourceMap = await this._stylesSourceMap[styleSheetId];

            sessionCache[styleSheetId] = {
                sourceMapUrl,
                sourceMap: sourceMap instanceof Error ? sourceMap.message : sourceMap,
                isError: sourceMap instanceof Error,
            };
        }

        return setCachedSelectivityFile(
            CacheType.CssSessionCache,
            this._wdSessionId,
            JSON.stringify(sessionCache),
        ).catch(err => {
            debugSelectivity(`Couldn't save session cache for session '%s': %O`, this._wdSessionId, err);
        });
    }

    private async _loadSessionCache(): Promise<void> {
        const sessionCacheString = await getCachedSelectivityFile(CacheType.CssSessionCache, this._wdSessionId);

        if (!sessionCacheString) {
            return;
        }

        let sessionCache: CssSessionCache | null = null;

        try {
            sessionCache = JSON.parse(sessionCacheString);
        } catch (err) {
            debugSelectivity("CSS Session cache is invalid JSON for session '%s': %O", this._wdSessionId, err);
        }

        if (!sessionCache) {
            return;
        }

        for (const styleSheetId in sessionCache) {
            const cachedData = sessionCache[styleSheetId];

            this._styleSheetIdToSourceMapUrl[styleSheetId] = cachedData.sourceMapUrl;

            if (!cachedData.isError) {
                this._stylesSourceMap[styleSheetId] = Promise.resolve(cachedData.sourceMap);
            } else {
                // If source map url was received, we can try to restore cache
                // If cache can't be restored, session should be considered as broken
                if (!cachedData.sourceMapUrl) {
                    const originalError = cachedData.sourceMap as string;
                    const errorMessage = [
                        "Selectivity: session is broken. Couldn't restore source map from previous test:",
                        "\t- " + originalError.split("\n").pop(),
                    ].join("\n");

                    // Not throwing the error right away because we might not need
                    this._stylesSourceMap[styleSheetId] = Promise.resolve(new Error(errorMessage));
                }
            }
        }
    }

    async start(): Promise<void> {
        const cssOnStyleSheetAdded = (this._cssOnStyleSheetAddedFn = this._processStyle.bind(this));

        this._cdp.css.on("styleSheetAdded", cssOnStyleSheetAdded);

        const [startTrackingResult, loadSessionCacheResult] = await Promise.all([
            this._cdp.css.startRuleUsageTracking(this._cdpSessionId).catch((err: Error) => err),
            this._loadSessionCache().catch((err: Error) => err),
        ]);

        if (startTrackingResult instanceof Error) {
            throw startTrackingResult;
        }

        if (loadSessionCacheResult instanceof Error) {
            debugSelectivity(
                "Couldn't load session cache for session '%s': %O",
                this._wdSessionId,
                loadSessionCacheResult,
            );
        }
    }

    async takeCoverageSnapshot(): Promise<void> {
        const coveragePart = await this._cdp.css.takeCoverageDelta(this._cdpSessionId);

        this._ensureStylesAreLoading(coveragePart.coverage);

        await this._waitForLoadingStyles();

        this._coverageResult.push(...coveragePart.coverage);
    }

    /** @param drop only performs cleanup without providing actual deps. Should be "true" if test is failed */
    async stop(drop?: boolean): Promise<Set<string> | null> {
        try {
            if (drop) {
                return null;
            }

            const coverageLastPart = await this._cdp.css.stopRuleUsageTracking(this._cdpSessionId);
            const coverageStyles = [...this._coverageResult, ...coverageLastPart.ruleUsage];

            this._ensureStylesAreLoading(coverageLastPart.ruleUsage);

            const totalDependingSourceFiles = new Set<string>();
            const grouppedByStyleSheetCoverage = groupBy(coverageStyles, "styleSheetId");
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
                            [
                                `CSS Selectivity: Couldn't load source maps for stylesheet id ${styleSheetId}:`,
                                String(sourceMap),
                            ].join("\n"),
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

            await this._saveSessionCache();

            return totalDependingSourceFiles;
        } finally {
            this._cssOnStyleSheetAddedFn && this._cdp.css.off("styleSheetAdded", this._cssOnStyleSheetAddedFn);
        }
    }
}
