"use strict";

const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const _ = require("lodash");
const { pngValidator: validatePng } = require("png-validator");
const { Image } = require("../../../image");
const { ElementsScreenShooter } = require("../../screen-shooter/elements-screen-shooter");
const { ViewportScreenShooter } = require("../../screen-shooter/viewport-screen-shooter");
const temp = require("../../../temp");
const { getCaptureProcessors } = require("./capture-processors");
const RuntimeConfig = require("../../../config/runtime-config");
const AssertViewResults = require("./assert-view-results");
const { BaseStateError } = require("./errors/base-state-error");
const { addTestplaneSelectivityPngDependency } = require("../../cdp/selectivity/testplane-selectivity");
const { AssertViewError } = require("./errors/assert-view-error");

const makeDebug = require("debug");
const debug = makeDebug("testplane:screenshots:assert-view");

const getShortDebugId = debugId => crypto.createHash("sha1").update(debugId).digest("hex").slice(0, 7);

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
    let elementsScreenShooterPromise;
    let viewportScreenShooterPromise;
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

    const getDefaultOpts = opts =>
        _.defaults(opts, assertViewOpts, {
            compositeImage,
            screenshotDelay,
            tolerance,
            antialiasingTolerance,
            disableAnimation,
        });

    const waitForStaticToLoad = async opts => {
        if (opts.waitForStaticToLoadTimeout) {
            // Interval between checks is "waitPageReadyTimeout / 10" ms, but at least 50ms and not more than 500ms
            await session.waitForStaticToLoad({
                timeout: opts.waitForStaticToLoadTimeout,
                interval: Math.min(Math.max(50, opts.waitForStaticToLoadTimeout / 10), 500),
            });
        }
    };

    const compareScreenshot = async (state, currImgInst, currImgMeta, opts) => {
        const { testplaneCtx } = session.executionContext;
        const test = session.executionContext.ctx.currentTest;
        testplaneCtx.assertViewResults = testplaneCtx.assertViewResults || AssertViewResults.create();

        if (testplaneCtx.assertViewResults.hasState(state)) {
            return Promise.reject(new AssertViewError(`duplicate name for "${state}" state`));
        }

        const handleCaptureProcessorError = e =>
            e instanceof BaseStateError ? testplaneCtx.assertViewResults.add(e) : Promise.reject(e);

        const { tempOpts, updateRefs: isUpdatingRefs } = RuntimeConfig.getInstance();
        temp.attach(tempOpts);

        const currSize = currImgInst.getSize();
        const currImg = { path: temp.path(Object.assign(tempOpts, { suffix: ".png" })), size: currSize };

        const refImgAbsolutePath = config.getScreenshotPath(test, state);
        const refImgRelativePath = refImgAbsolutePath && path.relative(process.cwd(), refImgAbsolutePath);
        const refImg = { path: refImgAbsolutePath, relativePath: refImgRelativePath, size: null };
        const { emitter } = browser;

        if (!fs.existsSync(refImg.path)) {
            await currImgInst.save(currImg.path);

            if (isUpdatingRefs) {
                addTestplaneSelectivityPngDependency(refImg.path);
            }

            return handleNoRefImage(currImg, refImg, state, { emitter }).catch(e => handleCaptureProcessorError(e));
        }

        addTestplaneSelectivityPngDependency(refImg.path);

        const { canHaveCaret, pixelRatio } = currImgMeta;
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

    const assertView = async (state, selectors, opts) => {
        opts = getDefaultOpts(opts);

        let debugId = "debugId";
        try {
            const test = session.executionContext.ctx.currentTest;
            const fullDebugId = `${test.fullTitle()}.${browser.id}.${state}`;
            debugId = getShortDebugId(fullDebugId);
            opts.debugId = debugId;
            debug(`[${debugId}] assertView id: ${fullDebugId}`);
        } catch {
            /**/
        }
        debug(`[${debugId}] assertView selectors: %O`, selectors);
        debug(`[${debugId}] assertView opts: %O`, opts);

        if (!elementsScreenShooterPromise) {
            const { isWebdriverProtocol, shouldUsePixelRatio, needsCompatLib } = browser;
            elementsScreenShooterPromise = ElementsScreenShooter.create({
                camera: browser.camera,
                browser: browser.publicAPI,
                browserProperties: { isWebdriverProtocol, shouldUsePixelRatio, needsCompatLib },
            });
        }

        const screenShooter = await elementsScreenShooterPromise;
        await waitForStaticToLoad(opts);
        const { image, meta } = await screenShooter.capture(selectors, opts);

        return compareScreenshot(state, image, meta, opts);
    };

    const PSEUDO_SELECTOR_REGEXP = /(.*?)(::before|::after)\s*$/i;
    const getSelectorToWaitForExist = selector => {
        if (!_.isString(selector)) {
            return selector;
        }
        const match = selector.match(PSEUDO_SELECTOR_REGEXP);
        if (!match) {
            return selector;
        }
        const elementSelector = match[1].trim();
        return elementSelector || selector;
    };

    const waitSelectorsForExist = async (browser, selectors) => {
        await Promise.all(
            [].concat(selectors).map(selector =>
                browser
                    .$(getSelectorToWaitForExist(selector))
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
        opts = getDefaultOpts(opts);

        debug(`assertViewByViewport state: ${state}, opts: %O`, opts);

        if (!viewportScreenShooterPromise) {
            const { isWebdriverProtocol, shouldUsePixelRatio, needsCompatLib } = browser;
            viewportScreenShooterPromise = ViewportScreenShooter.create({
                camera: browser.camera,
                browser: browser.publicAPI,
                browserProperties: { isWebdriverProtocol, shouldUsePixelRatio, needsCompatLib },
            });
        }

        const vpScreenShooter = await viewportScreenShooterPromise;
        await waitForStaticToLoad(opts);
        const { image, meta } = await vpScreenShooter.capture(opts);

        return compareScreenshot(state, image, meta, opts);
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
