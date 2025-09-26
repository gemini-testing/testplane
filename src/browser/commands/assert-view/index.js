"use strict";

const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");
const { pngValidator: validatePng } = require("png-validator");
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
        throw new Error(`Invalid ignoreDiffPixelCount value: got ${value}, but expected number or '\${number}%'`);
    }

    if (percent > 100 || percent < 0) {
        throw new Error(`Invalid ignoreDiffPixelCount value: percent should be in range between 0 and 100`);
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
            validatePng(refBuffer);
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
                        throw new Error(
                            `element ("${selector}") still not existing after ${browser.options.waitforTimeout} ms`,
                        );
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
                throw new Error(
                    `element ("${this.selector}") still not existing after ${this.options.waitforTimeout} ms`,
                );
            });

            return assertView(state, this.selector, opts);
        },
        true,
    );
};
