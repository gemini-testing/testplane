import { CSSSelectivity } from "./css-selectivity";
import { JSSelectivity } from "./js-selectivity";
import type { ExistingBrowser } from "../../existing-browser";
import { getTestDependenciesWriter } from "./test-dependencies-writer";
import type { Test } from "../../../types";
import { mergeSourceDependencies, transformSourceDependencies } from "./utils";
import { getFileHashWriter } from "./file-hash-writer";
import { Compression } from "./types";
import { getCollectedTestplaneDependencies } from "./testplane-selectivity";

type StopSelectivityFn = (test: Test, shouldWrite: boolean) => Promise<void>;

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
        const hashWriter = getFileHashWriter(testDependenciesPath, compression);
        const browserDeps = transformSourceDependencies(cssDependencies, jsDependencies);
        const testplaneDeps = transformSourceDependencies([], getCollectedTestplaneDependencies());

        hashWriter.add(mergeSourceDependencies(browserDeps, testplaneDeps));

        await Promise.all([testDependencyWriter.saveFor(test, browserDeps, testplaneDeps), hashWriter.commit()]);
    };
};
