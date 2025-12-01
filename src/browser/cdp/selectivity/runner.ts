import _ from "lodash";
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

export class SelectivityRunner {
    private readonly _config: Config;
    private readonly _runTestFn: (test: Test, browserId: string) => void;
    private readonly _browserSelectivityDisabledCache: Record<string, void | Promise<boolean>> = {};
    private readonly _processingTestPromises: Promise<void>[] = [];

    static create(...args: ConstructorParameters<typeof this>): SelectivityRunner {
        return new this(...args);
    }

    constructor(mainRunner: MainRunner, config: Config, runTestFn: (test: Test, browserId: string) => void) {
        this._config = config;
        this._runTestFn = runTestFn;

        mainRunner.on(MasterEvents.TEST_DEPENDENCIES, onTestDependencies);
    }

    private _shouldDisableSelectivityForBrowser(browserId: string): Promise<boolean> {
        if (this._browserSelectivityDisabledCache[browserId]) {
            return this._browserSelectivityDisabledCache[browserId] as Promise<boolean>;
        }

        const browserConfig = this._config.forBrowser(browserId);

        this._browserSelectivityDisabledCache[browserId] = shouldDisableBrowserSelectivity(browserConfig, browserId);

        return this._browserSelectivityDisabledCache[browserId] as Promise<boolean>;
    }

    runIfNecessary(test: Test, browserId: string): void {
        const browserConfig = this._config.forBrowser(browserId);
        const isSelectivityEnabledForBrowser = browserConfig.selectivity.enabled;

        if (!isSelectivityEnabledForBrowser) {
            return this._runTestFn(test, browserId);
        }

        this._processingTestPromises.push(
            (async (): Promise<void> => {
                const shouldDisableBrowserSelectivity = await this._shouldDisableSelectivityForBrowser(browserId);

                if (shouldDisableBrowserSelectivity) {
                    return this._runTestFn(test, browserId);
                }

                const shouldDisableTest = await shouldDisableTestBySelectivity(browserConfig, test);

                if (!shouldDisableTest) {
                    this._runTestFn(test, browserId);
                }
            })(),
        );
    }

    waitForTestsToRun(): Promise<void[]> {
        return Promise.all(this._processingTestPromises);
    }
}
