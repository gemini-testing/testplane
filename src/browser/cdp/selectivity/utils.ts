import { sortedIndex, memoize } from "lodash";
import { SourceMapConsumer, type BasicSourceMapConsumer, type RawSourceMap } from "source-map";
import fs from "fs";
import path from "path";
import { URL } from "url";
import type { CDPRuntime } from "../domains/runtime";
import type { CDPSessionId } from "../types";
import { softFileURLToPath } from "../../../utils/fs";
import type { NormalizedDependencies } from "./types";
import { WEBPACK_PROTOCOL } from "./constants";

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
): Promise<string | Error> => {
    const isSourceMapEmbedded = new URL(url).protocol === "data:";

    if (isSourceMapEmbedded) {
        // With "data" protocol it just decodes embedded source maps without actual network requests
        // So we can do it directly from node.js
        return fetch(url)
            .then(r => r.text())
            .catch((err: Error) => err);
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
            .then(r => r.result.value)
            .catch((err: Error) => err);
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
export const extractSourceFilesDeps = async (
    source: string,
    sourceMaps: string,
    startOffsets: number[],
    sourceRoot: string,
): Promise<Set<string>> => {
    const dependantSourceFiles = new Set<string>();
    const sourceMapsParsed = patchSourceMapSources(JSON.parse(sourceMaps), sourceRoot);

    const consumer = (await new SourceMapConsumer(sourceMapsParsed)) as BasicSourceMapConsumer;

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

const ensurePosixRelativeDependencyPathExists = memoize((posixRelativePath: string): void => {
    const relativePath = posixRelativePath.replaceAll(path.posix.sep, path.sep);

    if (fs.existsSync(relativePath)) {
        return;
    }

    throw new Error(`Selectivity: Couldn;t find "${relativePath}", which is test's dependency`);
});

/**
 * @param cssDependencies SORTED uniq array of css dependenciy URI's
 * @param jsDependencies SORTED uniq array of js dependenciy URI's
 * @returns sorted uniq arrays of relative paths
 */
export const transformSourceDependencies = (
    cssDependencies: string[],
    jsDependencies: string[],
): NormalizedDependencies => {
    const nodeModulesLabel = "node_modules/";
    const css: string[] = [];
    const js: string[] = [];
    const modules: string[] = [];

    const classifyDependency = (dependency: string, typedResultArray: string[]): void => {
        dependency = decodeURIComponent(softFileURLToPath(dependency));

        if (hasProtocol(dependency)) {
            throw new Error(`Selectivity: Found unsupported protocol in dependencies ("${dependency}")`);
        }

        const dependencyRelativePath = path.posix.relative(path.posix.resolve(), path.posix.resolve(dependency));

        const nodeModulesLabelPos = dependencyRelativePath.indexOf(nodeModulesLabel);

        if (nodeModulesLabelPos === -1) {
            ensurePosixRelativeDependencyPathExists(dependencyRelativePath);
            typedResultArray.push(dependencyRelativePath);
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
            typedResultArray.push(dependencyRelativePath);
        } else {
            const modulePath = dependencyRelativePath.slice(0, moduleEndPos);

            if (modules[modules.length - 1] !== modulePath) {
                ensurePosixRelativeDependencyPathExists(modulePath);

                modules.push(modulePath);
            }
        }
    };

    let cssIndex = 0;
    let jsIndex = 0;

    while (cssIndex < cssDependencies.length && jsIndex < jsDependencies.length) {
        const compareResult = cssDependencies[cssIndex].localeCompare(jsDependencies[jsIndex]);

        if (compareResult < 0) {
            classifyDependency(cssDependencies[cssIndex++], css);
        } else {
            classifyDependency(jsDependencies[jsIndex++], js);
        }
    }

    while (cssIndex < cssDependencies.length) {
        classifyDependency(cssDependencies[cssIndex++], css);
    }

    while (jsIndex < jsDependencies.length) {
        classifyDependency(jsDependencies[jsIndex++], js);
    }

    return { css, js, modules };
};

// Ensures file consistency
export const shallowSortObject = (obj: Record<string, unknown>): void => {
    const testBrowsers = Object.keys(obj).sort();

    for (const testBrowser of testBrowsers) {
        const testBrowserDeps = obj[testBrowser];

        delete obj[testBrowser];

        obj[testBrowser] = testBrowserDeps;
    }
};
