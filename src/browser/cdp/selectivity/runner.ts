import _ from "lodash";
import pLimit from "p-limit";
import type { Config } from "../../../config";
import type { BrowserConfig } from "../../../config/browser-config";
import type { MainRunner } from "../../../runner";
import { debugSelectivity } from "./debug";
import { getHashReader } from "./hash-reader";
import type { Test, TestDepsContext, TestDepsData } from "../../../types";
import { MasterEvents } from "../../../events";
import { getHashWriter } from "./hash-writer";
import { getTestDependenciesReader } from "./test-dependencies-reader";

/** Called at the start of testplane run per each browser */
const shouldDisableBrowserSelectivity = _.memoize(
    async (config: BrowserConfig, browserId: string): Promise<boolean> => {
        if (!config.selectivity.enabled) {
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
        return enabled
            ? enabled + "#" + testDependenciesPath + "#" + compression + "#" + disableSelectivityPatterns.join("#")
            : "";
    },
);

const shouldDisableTestBySelectivity = _.memoize(
    async (config: BrowserConfig, test: Test): Promise<boolean> => {
        const { enabled, testDependenciesPath, compression } = config.selectivity;

        if (!enabled) {
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

        return enabled ? enabled + "#" + testDependenciesPath + "#" + compression + "#" + test.id : "";
    },
);

const onTestDependencies = (context: TestDepsContext, data: TestDepsData): void => {
    const hashWriter = getHashWriter(context.testDependenciesPath, context.compression);

    hashWriter.addTestDependencyHashes(data);
};

interface SelectivityRunnerOptions {
    shouldDisableSelectivity?: boolean;
}

export class SelectivityRunner {
    private readonly _config: Config;
    private readonly _runTestFn: (test: Test, browserId: string) => void;
    private readonly _opts?: SelectivityRunnerOptions;
    private readonly _browserSelectivityDisabledCache: Record<string, void | Promise<boolean>> = {};
    private readonly _testsToRun: [Test, string][] = [];
    private readonly _processingTestLimit = pLimit(10);
    private readonly _processingTestPromises: Array<Promise<void>> = [];

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
        const isSelectivityEnabledForBrowser = browserConfig.selectivity.enabled;

        // If selectivity is disabled for browser
        if (!isSelectivityEnabledForBrowser || this._opts?.shouldDisableSelectivity) {
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

                const shouldDisableTest = await shouldDisableTestBySelectivity(browserConfig, test);

                if (!shouldDisableTest) {
                    this._testsToRun.push([test, browserId]);
                }
            }),
        );
    }

    async runNecessaryTests(): Promise<void> {
        await Promise.all(this._processingTestPromises);

        this._testsToRun.forEach(([test, browserId]) => {
            this._runTestFn(test, browserId);
        });

        // Free used memory
        this._processingTestPromises.length = 0;
        this._testsToRun.length = 0;

        shouldDisableBrowserSelectivity.cache.clear?.();
        shouldDisableTestBySelectivity.cache.clear?.();
    }
}
