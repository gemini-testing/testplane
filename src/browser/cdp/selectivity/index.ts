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
import { selectivityShouldWrite } from "./modes";

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

        if (!selectivityShouldWrite(enabled)) {
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
            await hashWriter.commit();
        } catch (cause) {
            const lines: string[] = [];
            lines.push("What happened: Selectivity failed to save the test dependencies hash to disk.");
            lines.push("\nPossible reasons:");
            lines.push("  - The disk is full or the target directory is read-only");
            lines.push("  - A file system permission error prevents writing the hash file");
            lines.push("  - A concurrent process is locking the hash file");
            lines.push("\nWhat you can do:");
            lines.push("  - Check available disk space and file permissions in the selectivity cache directory");
            lines.push("  - Review the cause error above for specific I/O details");
            throw new Error(lines.join("\n"), { cause });
        }
    }
};

export const startSelectivity = async (browser: ExistingBrowser): Promise<StopSelectivityFn> => {
    const { enabled, compression, sourceRoot, testDependenciesPath, mapDependencyRelativePath } =
        browser.config.selectivity;

    if (!selectivityShouldWrite(enabled) || !browser.publicAPI.isChromium) {
        return () => Promise.resolve();
    }

    if (compression === Compression.ZSTD && !process.versions.zstd) {
        const lines: string[] = [];
        lines.push("What happened: Selectivity compression 'zstd' is not supported by the current Node.js version.");
        lines.push(`\nCurrent Node.js version: ${process.version}`);
        lines.push("\nPossible reasons:");
        lines.push("  - Node.js version is older than 22, which does not have built-in zstd support");
        lines.push("\nWhat you can do:");
        lines.push("  - Upgrade Node.js to version 22 or later");
        lines.push("  - Change 'selectivity.compression' to 'gzip' or 'br' in your testplane.config.js");
        throw new Error(lines.join("\n"));
    }

    if (!browser.cdp) {
        const lines: string[] = [];
        lines.push(
            "What happened: Selectivity could not start because the DevTools (CDP) connection is not established.",
        );
        lines.push("\nPossible reasons:");
        lines.push("  - The browser was launched without DevTools Protocol support");
        lines.push(
            "  - The test is running in a non-Chromium browser (CDP is only available for Chromium-based browsers)",
        );
        lines.push("  - The 'devtools' option is disabled in the browser configuration");
        lines.push("\nWhat you can do:");
        lines.push("  - Enable DevTools in your testplane config: devtools: true");
        lines.push("  - Ensure you're running tests in a Chromium-based browser");
        throw new Error(lines.join("\n"));
    }

    const cdpTaget = browser.cdp.target;
    const handle = await browser.publicAPI.getWindowHandle();
    const { targetInfos } = await cdpTaget.getTargets();
    const cdpTargetId = targetInfos.find(t => handle.includes(t.targetId))?.targetId;

    if (!cdpTargetId) {
        const lines: string[] = [];
        lines.push("What happened: Selectivity could not match the current browser window handle to a CDP target.");
        lines.push(`\n  WebDriver handle: ${handle}`);
        lines.push(`  CDP targets: ${targetInfos.map(t => `"${t.targetId}"`).join(", ")}`);
        lines.push("\nPossible reasons:");
        lines.push("  - The browser window handle format doesn't match the CDP targetId format");
        lines.push("  - The page was navigated or closed between reading the handle and fetching CDP targets");
        lines.push("\nWhat you can do:");
        lines.push("  - Ensure the page is fully loaded and stable before selectivity starts recording");
        lines.push("  - Check for concurrent test or tab operations that may cause a mismatch");
        throw new Error(lines.join("\n"));
    }

    const sessionId = await cdpTaget.attachToTarget(cdpTargetId).then(r => r.sessionId);

    const cssSelectivity = new CSSSelectivity(browser.cdp, sessionId, sourceRoot);
    const jsSelectivity = new JSSelectivity(browser.cdp, sessionId, sourceRoot);

    await Promise.allSettled([cssSelectivity.start(), jsSelectivity.start()]).then(async ([css, js]) => {
        if (css.status === "rejected" || js.status === "rejected") {
            await Promise.all([cssSelectivity.stop(true), jsSelectivity.stop(true)]);

            const originalError =
                css.status === "rejected" ? css.reason : js.status === "rejected" ? js.reason : "unknown reason";

            const lines: string[] = [];
            lines.push("What happened: Selectivity failed to start CSS or JS coverage recording.");
            lines.push("\nPossible reasons:");
            lines.push("  - The CDP session was closed or the target page navigated away before recording started");
            lines.push("  - The browser's DevTools Protocol returned an error when enabling coverage");
            lines.push("\nWhat you can do:");
            lines.push("  - Check the cause error below for the specific CDP failure");
            lines.push("  - Ensure the page is not navigating when selectivity is being initialized");
            throw new Error(lines.join("\n"), { cause: originalError });
        }
    });

    /** @param drop only performs cleanup without writing anything. Should be "true" if test is failed */
    return async function stopSelectivity(test: Test, drop: boolean): Promise<void> {
        const [cssDependencies, jsDependencies] = await Promise.all([
            cssSelectivity.stop(drop),
            jsSelectivity.stop(drop),
        ]);

        cdpTaget.detachFromTarget(sessionId).catch(() => {});

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
