import _ from "lodash";
import { CSSSelectivity } from "./css-selectivity";
import { JSSelectivity } from "./js-selectivity";
import type { ExistingBrowser } from "../../existing-browser";
import { getTestDependenciesWriter } from "./test-dependencies-writer";
import type { Test } from "../../../types";
import { mergeSourceDependencies, transformSourceDependencies } from "./utils";
import { getHashWriter } from "./hash-writer";
import { Compression } from "./types";
import { getCollectedTestplaneDependencies } from "./testplane-selectivity";
import { getHashReader } from "./hash-reader";
import { debugSelectivity } from "./debug";
import { getTestDependenciesReader } from "./test-dependencies-reader";
import type { BrowserConfig } from "../../../config/browser-config";
import type { Config } from "../../../config";

type StopSelectivityFn = (test: Test, shouldWrite: boolean) => Promise<void>;

/** Called at the start of testplane run per each browser */
export const shouldDisableSelectivity = _.memoize(
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

/**
 * Called at the end of successfull testplane run
 * Not using "Promise.all" here because all hashes are already calculated and cached at the start
 */
export const updateDisableSelectivityPatternsHashes = async (config: Config): Promise<void> => {
    const browserIds = config.getBrowserIds();

    for (const browserId of browserIds) {
        const browserConfig = config.forBrowser(browserId);
        const { enabled, testDependenciesPath, compression, disableSelectivityPatterns } = browserConfig.selectivity;

        if (!enabled) {
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

        await hashWriter.commit();
    }
};

export const shouldDisableTestBySelectivity = _.memoize(
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

export const startSelectivity = async (browser: ExistingBrowser): Promise<StopSelectivityFn> => {
    if (!browser.config.selectivity.enabled || !browser.publicAPI.isChromium) {
        return () => Promise.resolve();
    }

    if (browser.config.selectivity.compression === Compression.ZSTD && !process.versions.zstd) {
        throw new Error(
            "Selectivity: Compression 'zstd' is not supported in your node version. Please, upgrade the node version to 22",
        );
    }

    if (!browser.cdp) {
        throw new Error("Selectivity: Devtools connection is not established, couldn't record selectivity without it");
    }

    const cdpTaget = browser.cdp.target;
    const handle = await browser.publicAPI.getWindowHandle();
    const { targetInfos } = await cdpTaget.getTargets();
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

    const sessionId = await cdpTaget.attachToTarget(cdpTargetId).then(r => r.sessionId);

    const cssSelectivity = new CSSSelectivity(browser.cdp, sessionId, browser.config.selectivity.sourceRoot);
    const jsSelectivity = new JSSelectivity(browser.cdp, sessionId, browser.config.selectivity.sourceRoot);

    await Promise.all([cssSelectivity.start(), jsSelectivity.start()]);

    /** @param drop only performs cleanup without writing anything. Should be "true" if test is failed */
    return async function stopSelectivity(test: Test, drop: boolean): Promise<void> {
        const [cssDependencies, jsDependencies] = await Promise.all([
            cssSelectivity.stop(drop),
            jsSelectivity.stop(drop),
        ]);

        cdpTaget.detachFromTarget(sessionId).catch(() => {});

        if (drop || (!cssDependencies.length && !jsDependencies.length)) {
            return;
        }

        const testDependenciesPath = browser.config.selectivity.testDependenciesPath;
        const compression = browser.config.selectivity.compression;
        const testDependencyWriter = getTestDependenciesWriter(testDependenciesPath, compression);
        const hashWriter = getHashWriter(testDependenciesPath, compression);
        const browserDeps = transformSourceDependencies(cssDependencies, jsDependencies);
        const testplaneDeps = transformSourceDependencies([], getCollectedTestplaneDependencies());

        hashWriter.addTestDependencyHashes(mergeSourceDependencies(browserDeps, testplaneDeps));

        await Promise.all([testDependencyWriter.saveFor(test, browserDeps, testplaneDeps), hashWriter.commit()]);
    };
};
