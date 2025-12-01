import { CSSSelectivity } from "./css-selectivity";
import { JSSelectivity } from "./js-selectivity";
import type { ExistingBrowser } from "../../existing-browser";
import { getTestDependenciesWriter } from "./test-dependencies-writer";
import type { Test, TestDepsContext, TestDepsData } from "../../../types";
import { mergeSourceDependencies, transformSourceDependencies } from "./utils";
import { getHashWriter } from "./hash-writer";
import { Compression } from "./types";
import { getCollectedTestplaneDependencies } from "./testplane-selectivity";
import { getHashReader } from "./hash-reader";
import type { Config } from "../../../config";
import { MasterEvents } from "../../../events";

type StopSelectivityFn = (test: Test, shouldWrite: boolean) => Promise<void>;

/**
 * Called at the end of successfull testplane run
 * Not using "Promise.all" here because all hashes are already calculated and cached at the start
 */
export const updateSelectivityHashes = async (config: Config): Promise<void> => {
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

export const startSelectivity = async (browser: ExistingBrowser): Promise<StopSelectivityFn> => {
    const { enabled, compression, sourceRoot, testDependenciesPath } = browser.config.selectivity;

    if (!enabled || !browser.publicAPI.isChromium) {
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

    const cssSelectivity = new CSSSelectivity(browser.cdp, sessionId, sourceRoot);
    const jsSelectivity = new JSSelectivity(browser.cdp, sessionId, sourceRoot);

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

        const testDependencyWriter = getTestDependenciesWriter(testDependenciesPath, compression);
        const browserDeps = transformSourceDependencies(cssDependencies, jsDependencies);
        const testplaneDeps = transformSourceDependencies([], getCollectedTestplaneDependencies());

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
