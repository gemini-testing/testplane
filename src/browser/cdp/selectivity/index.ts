import { CSSSelectivity } from "./css-selectivity";
import { JSSelectivity } from "./js-selectivity";
import type { ExistingBrowser } from "../../existing-browser";
import { getTestDependenciesWriter } from "./test-dependencies-writer";
import type { Test } from "../../../types";
import { transformSourceDependencies } from "./utils";
import { getFileHashWriter } from "./file-hash-writer";

type StopSelectivityFn = (test: Test, shouldWrite: boolean) => Promise<void>;

export const startSelectivity = async (browser: ExistingBrowser): Promise<StopSelectivityFn> => {
    if (!browser.config.selectivity.enabled || !browser.publicAPI.isChromium) {
        return () => Promise.resolve();
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

        const testDependencyWriter = getTestDependenciesWriter(browser.config.selectivity.testDependenciesPath);
        const hashWriter = getFileHashWriter(browser.config.selectivity.testDependenciesPath);
        const dependencies = transformSourceDependencies(cssDependencies, jsDependencies);

        hashWriter.add(dependencies);

        await Promise.all([testDependencyWriter.saveFor(test, dependencies), hashWriter.commit()]);
    };
};
