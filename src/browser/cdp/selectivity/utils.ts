import { sortedIndex, memoize } from "lodash";
import { SourceMapConsumer, type RawSourceMap } from "source-map-js";
import fs from "fs";
import path from "path";
import { URL } from "url";
import * as logger from "../../../utils/logger";
import type { CDPRuntime } from "../domains/runtime";
import type { CDPSessionId } from "../types";
import { softFileURLToPath } from "../../../utils/fs";
import type { CachedOnFs, HashFileContents, NormalizedDependencies, SelectivityCompressionType } from "./types";
import { WEBPACK_PROTOCOL } from "./constants";
import { readJsonWithCompression } from "./json-utils";
import type { Test } from "../../../types";

/**
 * Tries to fetch text by url from node.js, then falls back to "fetch" from browser, if node.js fetch fails
 * @param url text url
 * @param runtime CDP runtime domain
 * @param sessionId CDP session id
 * @returns text
 */
export const fetchTextWithBrowserFallback = async (
    url: string,
    runtime: CDPRuntime,
    sessionId: CDPSessionId,
): Promise<string> => {
    const isSourceMapEmbedded = new URL(url).protocol === "data:";

    if (isSourceMapEmbedded) {
        // With "data" protocol it just decodes embedded source maps without actual network requests
        // So we can do it directly from node.js
        return fetch(url).then(r => r.text());
    }

    // At first, trying to fetch sourceMaps directly from the node.js
    // Then falling back to do it via browser (if Testplane has no direct network access to it, for example)
    try {
        return await fetch(url).then(r => r.text());
    } catch {
        return runtime
            .evaluate<string>(sessionId, {
                expression: `fetch("${url.replaceAll('"', '\\"')}").then(r => r.text())`,
                awaitPromise: true,
                returnByValue: true,
            })
            .then(r => r.result.value);
    }
};

const isWebpackProtocol = (posixRelativeSourceFilePath: string): boolean => {
    return posixRelativeSourceFilePath.startsWith(WEBPACK_PROTOCOL);
};

/**
 * Replaces "webpack://" protocol with source path because "source-map" doesn't work well with protocol paths
 * @param sourceMap Raw source maps in https://tc39.es/ecma426/ format
 * @param sourceRoot Source root
 */
export const patchSourceMapSources = (sourceMap: RawSourceMap, sourceRoot?: string): RawSourceMap => {
    sourceMap.sourceRoot = sourceRoot || sourceMap.sourceRoot;

    for (let i = 0; i < sourceMap.sources.length; i++) {
        if (isWebpackProtocol(sourceMap.sources[i])) {
            sourceMap.sources[i] = sourceMap.sources[i].slice(WEBPACK_PROTOCOL.length);
        }
    }

    return sourceMap;
};

/**
 * Given compiled code, its source map, and the executed offsets
 * It returns the original source files touched
 * Useful for turning coverage ranges into real TS/JS module dependencies
 * @param source Compiled source code
 * @param sourceMaps Source maps JSON string
 * @param startOffsets Executed start offsets (v8 format)
 * @param sourceRoot Source root
 */
export const extractSourceFilesDeps = (
    source: string,
    sourceMaps: string,
    startOffsets: number[],
    sourceRoot: string,
): Set<string> => {
    const dependantSourceFiles = new Set<string>();
    const sourceMapsParsed = patchSourceMapSources(JSON.parse(sourceMaps), sourceRoot);

    const consumer = new SourceMapConsumer(sourceMapsParsed);

    let sourceOffset = source.indexOf("\n");
    const offsetToLine = [0];

    while (sourceOffset !== -1) {
        offsetToLine.push(++sourceOffset);
        sourceOffset = source.indexOf("\n", sourceOffset);
    }

    for (const startOffset of startOffsets) {
        let line = sortedIndex(offsetToLine, startOffset);

        if (startOffset < offsetToLine[line]) {
            line--;
        }

        const column = startOffset - offsetToLine[line];
        const position = consumer.originalPositionFor({ line: line + 1, column });

        if (position.source) {
            dependantSourceFiles.add(position.source);
        }
    }

    return dependantSourceFiles;
};

/**
 * @returns True, if fileUrlLikePath has some kind of protocol ("data://", "webpack://", "turbopack://", "file://")...
 */
export const hasProtocol = (fileUrlLikePath: string): boolean => {
    if (!fileUrlLikePath.includes("://")) {
        return false;
    }

    try {
        return Boolean(new URL(fileUrlLikePath).protocol);
    } catch {
        return false;
    }
};

const getProtocol = (fileUrlLikePath: string): string | null => {
    if (!fileUrlLikePath.includes("://")) {
        return null;
    }

    try {
        return new URL(fileUrlLikePath).protocol;
    } catch {
        return null;
    }
};

export const isDataProtocol = (fileUrlLikePath: string): boolean => fileUrlLikePath.startsWith("data:");

const ensurePosixRelativeDependencyPathExists = (posixRelativePath: string): void => {
    const relativePath = posixRelativePath.replaceAll(path.posix.sep, path.sep);

    if (fs.existsSync(relativePath)) {
        return;
    }

    throw new Error(
        [
            `Selectivity: Couldn't find "${relativePath}", which is test's dependency`,
            "Please ensure 'sources' of generated source maps contain valid paths to existing files",
            "Configuring 'sourceRoot' in Testplane selectivity config also might help",
        ].join("\n"),
    );
};

const warnUnsupportedProtocol = memoize((protocol: string, dependency: string): void => {
    logger.warn(`Selectivity: Ignoring dependencies of unsupported protocol "${protocol}" (example: "${dependency}")`);
});

/**
 * @param cssDependencies set of css dependenciy URI's
 * @param jsDependencies set of js dependenciy URI's
 * @returns sorted uniq arrays of relative paths
 */
export const transformSourceDependencies = (
    cssDependencies: Set<string> | null,
    jsDependencies: Set<string> | null,
    mapDependencyPathFn?: null | ((relativePath: string) => string | void),
): NormalizedDependencies => {
    const nodeModulesLabel = "node_modules/";
    const cssSet: Set<string> = new Set();
    const jsSet: Set<string> = new Set();
    const modulesSet: Set<string> = new Set();

    const classifyDependency = (dependency: string, typedResultSet: Set<string>): void => {
        dependency = decodeURIComponent(softFileURLToPath(dependency));

        const protocol = getProtocol(dependency);

        if (protocol) {
            warnUnsupportedProtocol(protocol, dependency);
            return;
        }

        const initialDependencyRelativePath = path.posix.relative(path.posix.resolve(), path.posix.resolve(dependency));

        const dependencyRelativePath = mapDependencyPathFn
            ? mapDependencyPathFn(initialDependencyRelativePath)
            : initialDependencyRelativePath;

        if (!dependencyRelativePath) {
            return;
        }

        const nodeModulesLabelPos = dependencyRelativePath.indexOf(nodeModulesLabel);

        if (nodeModulesLabelPos === -1) {
            ensurePosixRelativeDependencyPathExists(dependencyRelativePath);
            typedResultSet.add(dependencyRelativePath);
            return;
        }

        const modulePos = nodeModulesLabelPos + nodeModulesLabel.length;
        const isScopedDependency = dependencyRelativePath[modulePos] === "@";
        let moduleEndPos;

        if (isScopedDependency) {
            const scopeEndPos = dependencyRelativePath.indexOf("/", modulePos + 1);

            moduleEndPos = scopeEndPos === -1 ? -1 : dependencyRelativePath.indexOf("/", scopeEndPos + 1);
        } else {
            moduleEndPos = dependencyRelativePath.indexOf("/", modulePos + 1);
        }

        if (moduleEndPos === -1) {
            ensurePosixRelativeDependencyPathExists(dependencyRelativePath);
            typedResultSet.add(dependencyRelativePath);
        } else {
            const modulePath = dependencyRelativePath.slice(0, moduleEndPos);

            ensurePosixRelativeDependencyPathExists(modulePath);

            modulesSet.add(modulePath);
        }
    };

    if (cssDependencies) {
        for (const cssDependency of cssDependencies.values()) {
            classifyDependency(cssDependency, cssSet);
        }
    }

    if (jsDependencies) {
        for (const jsDependency of jsDependencies.values()) {
            classifyDependency(jsDependency, jsSet);
        }
    }

    const cmpStr = (a: string, b: string): number => a.localeCompare(b);

    return {
        css: Array.from(cssSet).sort(cmpStr),
        js: Array.from(jsSet).sort(cmpStr),
        modules: Array.from(modulesSet).sort(cmpStr),
    };
};

/** Merges two sorted deps array into one with uniq values */
export const mergeSourceDependencies = (
    a: NormalizedDependencies,
    b: NormalizedDependencies,
): NormalizedDependencies => {
    const result: NormalizedDependencies = { css: [], js: [], modules: [] };

    for (const depType of Object.keys(result) as Array<keyof NormalizedDependencies>) {
        let aInd = 0,
            bInd = 0;

        while (aInd < a[depType].length || bInd < b[depType].length) {
            let compareResult;

            if (bInd >= b[depType].length) {
                compareResult = -1;
            } else if (aInd >= a[depType].length) {
                compareResult = 1;
            } else {
                compareResult = a[depType][aInd].localeCompare(b[depType][bInd]);
            }

            if (compareResult < 0) {
                result[depType].push(a[depType][aInd]);

                do {
                    aInd++;
                } while (a[depType][aInd] === a[depType][aInd - 1]);
            } else if (compareResult > 0) {
                result[depType].push(b[depType][bInd]);

                do {
                    bInd++;
                } while (b[depType][bInd] === b[depType][bInd - 1]);
            } else {
                result[depType].push(a[depType][aInd]);

                do {
                    aInd++;
                } while (a[depType][aInd] === a[depType][aInd - 1]);

                do {
                    bInd++;
                } while (b[depType][bInd] === b[depType][bInd - 1]);
            }
        }
    }

    return result;
};

// Ensures file consistency
export const shallowSortObject = (obj: Record<string, unknown>): void => {
    const testBrowsers = Object.keys(obj).sort((a, b) => a.localeCompare(b));

    for (const testBrowser of testBrowsers) {
        const testBrowserDeps = obj[testBrowser];

        delete obj[testBrowser];

        obj[testBrowser] = testBrowserDeps;
    }
};

export const getSelectivityHashesPath = (testDependenciesPath: string): string =>
    path.join(testDependenciesPath, "hashes.json");

export const readHashFileContents = (
    selectivityHashesPath: string,
    compression: SelectivityCompressionType,
): Promise<HashFileContents> =>
    readJsonWithCompression(selectivityHashesPath, compression, {
        defaultValue: { files: {}, modules: {}, patterns: {} },
    })
        .catch(() => ({ files: {}, modules: {}, patterns: {} }))
        .then(res => {
            res.files ||= {};
            res.modules ||= {};
            res.patterns ||= {};

            return res;
        });

export const getSelectivityTestsPath = (testDependenciesPath: string): string =>
    path.join(testDependenciesPath, "tests");

export const getTestDependenciesPath = (selectivityTestsPath: string, test: Test): string =>
    path.join(selectivityTestsPath, `${test.id}.json`);

/** @returns `Promise<Record<BrowserID, Record<DepType, NormalizedDependencies>>>` */
export const readTestDependencies = (
    selectivityTestsPath: string,
    test: Test,
    compression: SelectivityCompressionType,
): Promise<Record<string, Record<string, NormalizedDependencies>>> =>
    readJsonWithCompression(getTestDependenciesPath(selectivityTestsPath, test), compression, {
        defaultValue: {},
    }).catch(() => ({}));

export const isCachedOnFs = (value: unknown): value is CachedOnFs => value === true;
