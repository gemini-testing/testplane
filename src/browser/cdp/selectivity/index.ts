import path from "node:path";
import fs from "fs-extra";
import { CSSSelectivity } from "./css-selectivity";
import { JSSelectivity } from "./js-selectivity";
import type { ExistingBrowser } from "../../existing-browser";
import { getTestDependenciesWriter } from "./test-dependencies-writer";
import type { Test, TestDepsContext, TestDepsData } from "../../../types";
import { getSelectivityTestsPath, mergeSourceDependencies, transformSourceDependencies } from "./utils";
import { getHashWriter } from "./hash-writer";
import { Compression } from "./types";
import { getCollectedTestplaneDependencies } from "./testplane-selectivity";
import { getHashReader } from "./hash-reader";
import type { Config } from "../../../config";
import { MasterEvents } from "../../../events";
import { selectivityShouldRead, selectivityShouldWrite } from "./modes";
import { debugSelectivity } from "./debug";
import { getUsedDumpsTracker } from "./used-dumps-tracker";
import { DebuggerEvents } from "../domains/debugger";
import { CDPSessionId } from "../types";

type StopSelectivityFn = (test: Test, shouldWrite: boolean) => Promise<void>;

/**
 * Called at the end of successfull testplane run
 * Not using "Promise.all" here because all hashes are already calculated and cached at the start
 */
export const updateSelectivityHashes = async (config: Config): Promise<void> => {
    const browserIds = config.getBrowserIds();
    const processedRoots = new Set();

    for (const browserId of browserIds) {
        const browserConfig = config.forBrowser(browserId);
        const { enabled, testDependenciesPath, compression, disableSelectivityPatterns } = browserConfig.selectivity;
        const shouldReadExistingHashes = selectivityShouldRead(enabled);
        const rootKey = `${shouldReadExistingHashes}#${testDependenciesPath}#${compression}`;

        if (!selectivityShouldWrite(enabled) || processedRoots.has(rootKey)) {
            continue;
        }

        const hashReader = getHashReader(testDependenciesPath, compression);
        const hashWriter = getHashWriter(testDependenciesPath, compression);

        for (const pattern of disableSelectivityPatterns) {
            const isChanged = await hashReader.patternHasChanged(pattern);

            if (isChanged) {
                hashWriter.addPatternDependencyHash(pattern);
            }
        }

        try {
            await hashWriter.save(shouldReadExistingHashes);
        } catch (cause) {
            throw new Error("Selectivity: couldn't save test dependencies hash", { cause });
        }

        processedRoots.add(rootKey);
    }
};

export const clearUnusedSelectivityDumps = async (config: Config): Promise<void> => {
    const usedDumpsTracker = getUsedDumpsTracker();
    const browserIds = config.getBrowserIds();
    const selectivityRoots: string[] = [];

    for (const browserId of browserIds) {
        const browserConfig = config.forBrowser(browserId);
        const { enabled, testDependenciesPath } = browserConfig.selectivity;

        if (selectivityShouldWrite(enabled) && !selectivityRoots.includes(testDependenciesPath)) {
            selectivityRoots.push(testDependenciesPath);
        }
    }

    let filesTotal = 0;
    let filesDeleted = 0;

    // eslint-disable-next-line no-bitwise
    const rwMode = fs.constants.R_OK | fs.constants.W_OK;

    await Promise.all(
        selectivityRoots.map(async selectivityRoot => {
            if (!usedDumpsTracker.usedDumpsFor(selectivityRoot)) {
                return;
            }

            const testsPath = getSelectivityTestsPath(selectivityRoot);
            const accessError = await fs.access(testsPath, rwMode).catch((err: Error) => err);

            if (accessError) {
                if (!("code" in accessError && accessError.code === "ENOENT")) {
                    debugSelectivity(`Couldn't access "${testsPath}" to clear stale files: %O`, accessError);
                }

                return;
            }

            const testsFileNames = await fs.readdir(testsPath);

            filesTotal += testsFileNames.length;

            for (const testFileName of testsFileNames) {
                const extensionPosition = testFileName.indexOf(".json");

                // If the file does not look like selectivity test dependencies, skip it
                if (extensionPosition === -1) {
                    continue;
                }

                const dumpId = testFileName.slice(0, extensionPosition);

                if (!usedDumpsTracker.wasUsed(dumpId, selectivityRoot)) {
                    const filePath = path.join(testsPath, testFileName);

                    await fs
                        .unlink(filePath)
                        .then(() => {
                            filesDeleted++;
                        })
                        .catch(err => {
                            debugSelectivity(`Couldn't remove stale file "${filePath}": %O`, err);
                        });
                }
            }
        }),
    );

    if (filesDeleted) {
        debugSelectivity(`Out of ${filesTotal} dump files, ${filesDeleted} were considered as outdated and deleted`);
    }
};

const testplaneCoverageBreakScriptName = "__testplane_cdp_coverage_snapshot_pause";
const scriptToEvaluateOnNewDocument = `window.addEventListener("beforeunload", function ${testplaneCoverageBreakScriptName}() {debugger;});`;

export const startSelectivity = async (browser: ExistingBrowser): Promise<StopSelectivityFn> => {
    const { enabled, compression, sourceRoot, testDependenciesPath, mapDependencyRelativePath } =
        browser.config.selectivity;

    if (!selectivityShouldWrite(enabled) || !browser.publicAPI.isChromium) {
        return () => Promise.resolve();
    }

    if (compression === Compression.ZSTD && !process.versions.zstd) {
        throw new Error(
            "Selectivity: Compression 'zstd' is not supported in your node version. Please, upgrade the node version to 22",
        );
    }

    if (!browser.cdp) {
        throw new Error("Selectivity: Devtools connection is not established, couldn't record selectivity without it");
    }

    const cdp = browser.cdp;
    const handle = await browser.publicAPI.getWindowHandle();
    const { targetInfos } = await cdp.target.getTargets();
    const cdpTargetId = targetInfos.find(t => handle.includes(t.targetId))?.targetId;

    if (!cdpTargetId) {
        throw new Error(
            [
                "Selectivity: Couldn't find current page;",
                `\n\t- webdriver handle: ${handle}`,
                `\n\t- cdp targets: ${targetInfos.map(t => `"${t.targetId}"`).join(", ")}`,
            ].join(""),
        );
    }

    const sessionId = await cdp.target.attachToTarget(cdpTargetId).then(r => r.sessionId);

    const cssSelectivity = new CSSSelectivity(cdp, sessionId, sourceRoot);
    const jsSelectivity = new JSSelectivity(cdp, sessionId, sourceRoot);

    await Promise.all([
        cdp.dom.enable(sessionId).then(() => cdp.css.enable(sessionId)),
        cdp.target.setAutoAttach(sessionId, { autoAttach: true, waitForDebuggerOnStart: false }),
        cdp.debugger.enable(sessionId),
        cdp.page.enable(sessionId),
        cdp.profiler.enable(sessionId),
    ]);

    await Promise.allSettled([cssSelectivity.start(), jsSelectivity.start()]).then(async ([css, js]) => {
        if (css.status === "rejected" || js.status === "rejected") {
            await Promise.all([cssSelectivity.stop(true), jsSelectivity.stop(true)]);

            const originalError =
                css.status === "rejected" ? css.reason : js.status === "rejected" ? js.reason : "unknown reason";

            throw new Error("Selectivity: Couldn't start selectivity", { cause: originalError });
        }
    });

    let pageSwitchPromise: Promise<void> = Promise.resolve();
    let isSelectivityStopped = false;

    const debuggerPausedFn = ({ callFrames }: DebuggerEvents["paused"], eventCdpSessionId?: CDPSessionId): void => {
        if (eventCdpSessionId !== sessionId) {
            return;
        }

        if (callFrames[0]?.functionName !== testplaneCoverageBreakScriptName || isSelectivityStopped) {
            cdp.debugger.resume(sessionId).catch(() => {});
            return;
        }

        pageSwitchPromise = pageSwitchPromise.finally(() =>
            Promise.all([cssSelectivity.takeCoverageSnapshot(), jsSelectivity.takeCoverageSnapshot()])
                .catch(err => {
                    console.error("Selectivity: couldn't take snapshot while navigating:", err);
                })
                .then(() => {
                    cdp.debugger.resume(sessionId).catch(() => {});
                }),
        );
    };

    cdp.debugger.on("paused", debuggerPausedFn);

    await cdp.page.addScriptToEvaluateOnNewDocument(sessionId, { source: scriptToEvaluateOnNewDocument });

    /** @param drop only performs cleanup without writing anything. Should be "true" if test is failed */
    return async function stopSelectivity(test: Test, drop: boolean): Promise<void> {
        isSelectivityStopped = true;

        await pageSwitchPromise;

        const [cssDependenciesPromise, jsDependenciesPromise] = await Promise.allSettled([
            cssSelectivity.stop(drop),
            jsSelectivity.stop(drop),
        ]);

        cdp.debugger.off("paused", debuggerPausedFn);
        cdp.target.detachFromTarget(sessionId).catch(() => {});

        if (jsDependenciesPromise.status === "rejected") {
            throw jsDependenciesPromise.reason;
        }

        if (cssDependenciesPromise.status === "rejected") {
            throw cssDependenciesPromise.reason;
        }

        const cssDependencies = cssDependenciesPromise.value;
        const jsDependencies = jsDependenciesPromise.value;

        if (drop || (!cssDependencies?.size && !jsDependencies?.size)) {
            return;
        }

        const mapBrowserDepsRelativePath = mapDependencyRelativePath
            ? (relativePath: string): string | void => mapDependencyRelativePath({ scope: "browser", relativePath })
            : null;

        const mapTestplaneDepsRelativePath = mapDependencyRelativePath
            ? (relativePath: string): string | void => mapDependencyRelativePath({ scope: "testplane", relativePath })
            : null;

        const testDependencyWriter = getTestDependenciesWriter(testDependenciesPath, compression);
        const browserDeps = transformSourceDependencies(cssDependencies, jsDependencies, mapBrowserDepsRelativePath);
        const testplaneDeps = transformSourceDependencies(
            null,
            getCollectedTestplaneDependencies(),
            mapTestplaneDepsRelativePath,
        );

        process.send?.({
            event: MasterEvents.TEST_DEPENDENCIES,
            context: {
                testDependenciesPath,
                compression,
                testId: test.id,
                fullTitle: test.fullTitle(),
                browserId: test.browserId,
            } satisfies TestDepsContext,
            data: mergeSourceDependencies(browserDeps, testplaneDeps) satisfies TestDepsData,
        });

        await testDependencyWriter.saveFor(test, browserDeps, testplaneDeps);
    };
};
