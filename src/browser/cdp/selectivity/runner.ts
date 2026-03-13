import _ from "lodash";
import fs from "fs-extra";
import pLimit from "p-limit";
import * as logger from "../../../utils/logger";
import type { Config } from "../../../config";
import type { BrowserConfig } from "../../../config/browser-config";
import type { MainRunner } from "../../../runner";
import { debugSelectivity } from "./debug";
import { getHashReader } from "./hash-reader";
import type { Test, TestDepsContext, TestDepsData } from "../../../types";
import { MasterEvents } from "../../../events";
import { getHashWriter } from "./hash-writer";
import { getTestDependenciesReader } from "./test-dependencies-reader";
import { selectivityShouldRead } from "./modes";

/** Called at the start of testplane run per each browser */
const shouldDisableBrowserSelectivity = _.memoize(
    async (config: BrowserConfig, browserId: string): Promise<boolean> => {
        if (!selectivityShouldRead(config.selectivity.enabled)) {
            return true;
        }

        if (!config.selectivity.disableSelectivityPatterns.length) {
            return false;
        }

        const hashReader = getHashReader(config.selectivity.testDependenciesPath, config.selectivity.compression);

        return new Promise<boolean>(resolve => {
            let isSettled = false;

            Promise.all(
                config.selectivity.disableSelectivityPatterns.map(pattern => {
                    return hashReader
                        .patternHasChanged(pattern)
                        .then(hasChanged => {
                            if (hasChanged && !isSettled) {
                                isSettled = true;
                                debugSelectivity(
                                    `Disabling selectivity for ${browserId}: file change by pattern "${pattern}" is detected`,
                                );
                                resolve(true);
                            }
                        })
                        .catch(err => {
                            if (!isSettled) {
                                isSettled = true;
                                debugSelectivity(
                                    `Disabling selectivity for ${browserId}: got an error while checking 'disableSelectivityPatterns': %O`,
                                    err,
                                );
                                resolve(true);
                            }
                        });
                }),
            ).then(() => {
                if (!isSettled) {
                    debugSelectivity(`None of 'disableSelectivityPatterns' is changed for ${browserId}`);
                    resolve(false);
                }
            });
        });
    },
    config => {
        const { enabled, testDependenciesPath, compression, disableSelectivityPatterns } = config.selectivity;

        return selectivityShouldRead(enabled)
            ? testDependenciesPath + "#" + compression + "#" + disableSelectivityPatterns.join("#")
            : "";
    },
);

const shouldDisableTestBySelectivity = _.memoize(
    async (config: BrowserConfig, test: Test): Promise<boolean> => {
        const { enabled, testDependenciesPath, compression } = config.selectivity;

        if (!selectivityShouldRead(enabled)) {
            return false;
        }

        const testDepsReader = getTestDependenciesReader(testDependenciesPath, compression);
        const hashReader = getHashReader(testDependenciesPath, compression);

        const testDeps = await testDepsReader.getFor(test);

        if (!testDeps.js.length) {
            debugSelectivity(
                `Not disabling "${test.fullTitle()}" as it has no js deps and therefore it was considered as new`,
            );
            return false;
        }

        const changedDeps = await hashReader.getTestChangedDeps(testDeps);

        if (changedDeps) {
            debugSelectivity(`Not disabling "${test.fullTitle()}" as its dependencies were changed: %O`, changedDeps);
        } else {
            debugSelectivity(`Disabling "${test.fullTitle()}" as its dependencies were not changed`);
        }

        return !changedDeps;
    },
    (config, test) => {
        const { enabled, testDependenciesPath, compression } = config.selectivity;

        return selectivityShouldRead(enabled) ? testDependenciesPath + "#" + compression + "#" + test.id : "";
    },
);

const onTestDependencies = (context: TestDepsContext, data: TestDepsData): void => {
    const hashWriter = getHashWriter(context.testDependenciesPath, context.compression);

    hashWriter.addTestDependencyHashes(data);
};

interface SelectivityRunnerOptions {
    shouldDisableSelectivity?: boolean;
}

interface SelectivityBrowserStats {
    processedCount: number;
    skippedCount: number;
}

interface SelectivityReport {
    totalProcessedCount: number;
    totalSkippedCount: number;
    perBrowserStats: Record<string, SelectivityBrowserStats>;
}

export class SelectivityRunner {
    private readonly _config: Config;
    private readonly _runTestFn: (test: Test, browserId: string) => void;
    private readonly _opts?: SelectivityRunnerOptions;
    private readonly _browserSelectivityDisabledCache: Record<string, void | Promise<boolean>> = {};
    private readonly _testsToRun: [Test, string][] = [];
    private readonly _processingTestLimit = pLimit(16);
    private readonly _processingTestPromises: Array<Promise<void>> = [];
    private readonly _stats: Record<string, SelectivityBrowserStats> = {};

    static create(...args: ConstructorParameters<typeof this>): SelectivityRunner {
        return new this(...args);
    }

    constructor(
        mainRunner: MainRunner,
        config: Config,
        runTestFn: (test: Test, browserId: string) => void,
        opts?: SelectivityRunnerOptions,
    ) {
        this._config = config;
        this._runTestFn = runTestFn;
        this._opts = opts;

        if (this._opts?.shouldDisableSelectivity) {
            debugSelectivity("Test filter is specified, disabling selectivity");
        } else {
            mainRunner.on(MasterEvents.TEST_DEPENDENCIES, onTestDependencies);
        }
    }

    private _shouldDisableSelectivityForBrowser(browserId: string): Promise<boolean> {
        if (this._browserSelectivityDisabledCache[browserId]) {
            return this._browserSelectivityDisabledCache[browserId] as Promise<boolean>;
        }

        const browserConfig = this._config.forBrowser(browserId);

        this._browserSelectivityDisabledCache[browserId] = shouldDisableBrowserSelectivity(browserConfig, browserId);

        return this._browserSelectivityDisabledCache[browserId] as Promise<boolean>;
    }

    startTestCheckToRun(test: Test, browserId: string): void {
        const browserConfig = this._config.forBrowser(browserId);
        const shouldSelectivelySkipTests = selectivityShouldRead(browserConfig.selectivity.enabled);

        // If selectivity is disabled for browser
        // If test is disabled on its own (e.g plugin testplane/chunks) we dont waste our time calculating the deps.
        if (!shouldSelectivelySkipTests || this._opts?.shouldDisableSelectivity || test.disabled) {
            this._testsToRun.push([test, browserId]);
            return;
        }

        this._processingTestPromises.push(
            this._processingTestLimit(async () => {
                const shouldDisableBrowserSelectivity = await this._shouldDisableSelectivityForBrowser(browserId);

                if (shouldDisableBrowserSelectivity) {
                    this._testsToRun.push([test, browserId]);
                    return;
                }

                this._stats[browserId] ||= {
                    processedCount: 0,
                    skippedCount: 0,
                };

                this._stats[browserId].processedCount++;

                const shouldDisableTest = await shouldDisableTestBySelectivity(browserConfig, test);

                if (!shouldDisableTest) {
                    this._testsToRun.push([test, browserId]);
                } else {
                    this._stats[browserId].skippedCount++;
                }
            }),
        );
    }

    async runNecessaryTests(): Promise<void> {
        await Promise.all(this._processingTestPromises);

        const saveReportPromise = this._saveSelectivityReport().catch(reason => {
            logger.error("Couldn't save selectivity report. Reason:", reason);
        });

        this._testsToRun.forEach(([test, browserId]) => {
            this._runTestFn(test, browserId);
        });

        // Free used memory
        this._processingTestPromises.length = 0;
        this._testsToRun.length = 0;

        shouldDisableBrowserSelectivity.cache.clear?.();
        shouldDisableTestBySelectivity.cache.clear?.();
        this._config.getBrowserIds().forEach(browserId => {
            const { selectivity } = this._config.forBrowser(browserId);

            getHashReader(selectivity.testDependenciesPath, selectivity.compression).clearCache();
        });

        await saveReportPromise;
    }

    async _saveSelectivityReport(): Promise<void> {
        const browserReportPaths = Object.keys(this._stats).reduce((acc, browserId) => {
            const reportPath =
                process.env.TESTPLANE_SELECTIVITY_REPORT_PATH ||
                this._config.forBrowser(browserId).selectivity.reportPath;

            if (reportPath) {
                acc[reportPath] ||= [];
                acc[reportPath].push(browserId);
            }

            return acc;
        }, {} as Record<string, string[]>);

        const promises = await Promise.allSettled(
            Object.keys(browserReportPaths).map(async reportPath => {
                const report: SelectivityReport = {
                    totalProcessedCount: 0,
                    totalSkippedCount: 0,
                    perBrowserStats: {},
                };

                for (const browserId of browserReportPaths[reportPath]) {
                    report.totalProcessedCount += this._stats[browserId].processedCount;
                    report.totalSkippedCount += this._stats[browserId].skippedCount;
                    report.perBrowserStats[browserId] = this._stats[browserId];
                }

                await fs.outputJson(reportPath, report, { spaces: 4 });
            }),
        );

        const failedPromise = promises.find(promise => promise.status === "rejected");

        if (failedPromise && "reason" in failedPromise) {
            throw failedPromise.reason;
        }
    }
}
