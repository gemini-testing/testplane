"use strict";

const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");
const { Image } = require("../../../image");
const ScreenShooter = require("../../screen-shooter");
const temp = require("../../../temp");
const { getCaptureProcessors } = require("./capture-processors");
const RuntimeConfig = require("../../../config/runtime-config");
const AssertViewResults = require("./assert-view-results");
const { BaseStateError } = require("./errors/base-state-error");

const getIgnoreDiffPixelCountRatio = value => {
    const percent = _.isString(value) && value.endsWith("%") ? parseFloat(value.slice(0, -1)) : false;

    if (percent === false || _.isNaN(percent)) {
        const lines = [];
        lines.push(
            `Invalid "ignoreDiffPixelCount" value: received "${value}", but expected a number or a percent string like "5%".`,
        );
        lines.push("");
        lines.push("Possible reasons:");
        lines.push('  - The value is a string but does not end with "%" or contains non-numeric characters.');
        lines.push("  - The option was set programmatically with an incorrect type.");
        lines.push("");
        lines.push("What you can do:");
        lines.push("  - Use a plain number (e.g. ignoreDiffPixelCount: 10) to allow up to N differing pixels.");
        lines.push('  - Use a percent string (e.g. ignoreDiffPixelCount: "1%") to allow up to N% of differing pixels.');
        throw new Error(lines.join("\n"));
    }

    if (percent > 100 || percent < 0) {
        const lines = [];
        lines.push(`Invalid "ignoreDiffPixelCount" percent value: ${value} is out of the allowed range [0%, 100%].`);
        lines.push("");
        lines.push("Possible reasons:");
        lines.push("  - The percent value is negative.");
        lines.push("  - The percent value exceeds 100.");
        lines.push("");
        lines.push("What you can do:");
        lines.push('  - Use a percent string in the range [0%, 100%], e.g. "5%" or "0.5%".');
        throw new Error(lines.join("\n"));
    }

    return percent / 100;
};

module.exports.default = browser => {
    const screenShooter = ScreenShooter.create(browser);
    const { publicAPI: session, config } = browser;
    const {
        assertViewOpts,
        compareOpts,
        compositeImage,
        screenshotDelay,
        tolerance,
        antialiasingTolerance,
        disableAnimation,
    } = config;

    const { handleNoRefImage, handleImageDiff, handleInvalidRefImage } = getCaptureProcessors();

    const assertView = async (state, selectors, opts) => {
        opts = _.defaults(opts, assertViewOpts, {
            compositeImage,
            screenshotDelay,
            tolerance,
            antialiasingTolerance,
            disableAnimation,
        });

        const { testplaneCtx } = session.executionContext;
        testplaneCtx.assertViewResults = testplaneCtx.assertViewResults || AssertViewResults.create();

        if (testplaneCtx.assertViewResults.hasState(state)) {
            return Promise.reject(new Error(`duplicate name for "${state}" state`));
        }

        if (opts.waitForStaticToLoadTimeout) {
            // Interval between checks is "waitPageReadyTimeout / 10" ms, but at least 50ms and not more than 500ms
            await session.waitForStaticToLoad({
                timeout: opts.waitForStaticToLoadTimeout,
                interval: Math.min(Math.max(50, opts.waitForStaticToLoadTimeout / 10), 500),
            });
        }

        const handleCaptureProcessorError = e =>
            e instanceof BaseStateError ? testplaneCtx.assertViewResults.add(e) : Promise.reject(e);

        const page = await browser.prepareScreenshot([].concat(selectors), {
            ignoreSelectors: [].concat(opts.ignoreElements),
            allowViewportOverflow: opts.allowViewportOverflow,
            captureElementFromTop: opts.captureElementFromTop,
            selectorToScroll: opts.selectorToScroll,
            disableAnimation: opts.disableAnimation,
        });

        const { tempOpts } = RuntimeConfig.getInstance();
        temp.attach(tempOpts);

        const screenshoterOpts = _.pick(opts, [
            "allowViewportOverflow",
            "compositeImage",
            "screenshotDelay",
            "selectorToScroll",
        ]);
        const currImgInst = await screenShooter
            .capture(page, screenshoterOpts)
            .finally(() => browser.cleanupScreenshot(opts));
        const currSize = await currImgInst.getSize();
        const currImg = { path: temp.path(Object.assign(tempOpts, { suffix: ".png" })), size: currSize };

        const test = session.executionContext.ctx.currentTest;
        const refImgAbsolutePath = config.getScreenshotPath(test, state);
        const refImgRelativePath = refImgAbsolutePath && path.relative(process.cwd(), refImgAbsolutePath);
        const refImg = { path: refImgAbsolutePath, relativePath: refImgRelativePath, size: null };
        const { emitter } = browser;

        if (!fs.existsSync(refImg.path)) {
            await currImgInst.save(currImg.path);

            return handleNoRefImage(currImg, refImg, state, { emitter }).catch(e => handleCaptureProcessorError(e));
        }

        const { canHaveCaret, pixelRatio } = page;
        const imageCompareOpts = {
            tolerance: opts.tolerance,
            antialiasingTolerance: opts.antialiasingTolerance,
            canHaveCaret,
            pixelRatio,
            compareOpts,
        };
        const currBuffer = await currImgInst.toPngBuffer({ resolveWithObject: false });
        const refBuffer = await fs.readFile(refImg.path);

        try {
            require("png-validator").pngValidator(refBuffer);
        } catch (err) {
            await currImgInst.save(currImg.path);

            return handleInvalidRefImage(currImg, refImg, state, { emitter }).catch(e =>
                handleCaptureProcessorError(e),
            );
        }

        const {
            equal,
            diffBounds,
            diffClusters,
            diffImage,
            metaInfo = {},
            differentPixels,
            totalPixels,
        } = await Image.compare(refBuffer, currBuffer, imageCompareOpts);
        Object.assign(refImg, metaInfo.refImg);

        const diffRatio = differentPixels / totalPixels;
        const isMinorDiff = _.isString(opts.ignoreDiffPixelCount)
            ? diffRatio <= getIgnoreDiffPixelCountRatio(opts.ignoreDiffPixelCount)
            : differentPixels <= opts.ignoreDiffPixelCount;

        if (!equal && !isMinorDiff) {
            const diffBuffer = await diffImage.createBuffer("png");
            const diffAreas = { diffBounds, diffClusters };
            const { tolerance, antialiasingTolerance } = opts;
            const imageDiffOpts = {
                tolerance,
                antialiasingTolerance,
                canHaveCaret,
                diffAreas,
                config,
                emitter,
                diffBuffer,
                differentPixels,
                diffRatio,
            };

            await fs.outputFile(currImg.path, currBuffer);

            return handleImageDiff(currImg, refImg, state, imageDiffOpts).catch(e => handleCaptureProcessorError(e));
        }

        testplaneCtx.assertViewResults.add({ stateName: state, refImg: refImg });
    };

    const waitSelectorsForExist = async (browser, selectors) => {
        await Promise.all(
            [].concat(selectors).map(selector =>
                browser
                    .$(selector)
                    .then(el => el.waitForExist())
                    .catch(() => {
                        const lines = [];
                        lines.push(
                            `Element ("${selector}") still not found after ${browser.options.waitforTimeout} ms.`,
                        );
                        lines.push("");
                        lines.push("Possible reasons:");
                        lines.push("  - The selector does not match any element in the current DOM.");
                        lines.push("  - The element appears after the waitforTimeout has already expired.");
                        lines.push("  - The page has not finished rendering the expected content.");
                        lines.push("");
                        lines.push("What you can do:");
                        lines.push(
                            `  - Check that the selector "${selector}" is correct and targets the right element.`,
                        );
                        lines.push('  - Increase "waitforTimeout" in your browser config if the element loads slowly.');
                        lines.push("  - Add an explicit wait before calling assertView.");
                        throw new Error(lines.join("\n"));
                    }),
            ),
        );
    };

    const assertViewBySelector = async (browser, state, selectors, opts) => {
        await waitSelectorsForExist(browser, selectors);

        return assertView(state, selectors, opts);
    };

    const assertViewByViewport = async (state, opts) => {
        opts = Object.assign(opts, {
            allowViewportOverflow: true,
            compositeImage: false,
            captureElementFromTop: false,
        });

        return assertView(state, "body", opts);
    };

    const shouldAssertViewport = selectorsOrOpts => {
        return !(typeof selectorsOrOpts === "string" || _.isArray(selectorsOrOpts));
    };

    session.addCommand("assertView", async function (state, selectorsOrOpts, opts = {}) {
        return shouldAssertViewport(selectorsOrOpts)
            ? assertViewByViewport(state, selectorsOrOpts || opts)
            : assertViewBySelector(this, state, selectorsOrOpts, opts);
    });

    session.addCommand(
        "assertView",
        async function (state, opts = {}) {
            await this.waitForExist({ timeoutMsg: "custom timeout msg" }).catch(() => {
                const lines = [];
                lines.push(`Element ("${this.selector}") still not found after ${this.options.waitforTimeout} ms.`);
                lines.push("");
                lines.push("Possible reasons:");
                lines.push("  - The selector does not match any element in the current DOM.");
                lines.push("  - The element appears after the waitforTimeout has already expired.");
                lines.push("  - The page has not finished rendering the expected content.");
                lines.push("");
                lines.push("What you can do:");
                lines.push(`  - Check that the selector "${this.selector}" is correct and targets the right element.`);
                lines.push('  - Increase "waitforTimeout" in your browser config if the element loads slowly.');
                lines.push("  - Add an explicit wait before calling assertView.");
                throw new Error(lines.join("\n"));
            });

            return assertView(state, this.selector, opts);
        },
        true,
    );
};
