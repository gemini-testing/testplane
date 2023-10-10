"use strict";

const fs = require("fs-extra");
const _ = require("lodash");
const Promise = require("bluebird");
const { pngValidator: validatePng } = require("png-validator");
const Image = require("../../../image");
const ScreenShooter = require("../../screen-shooter");
const temp = require("../../../temp");
const { getCaptureProcessors } = require("./capture-processors");
const RuntimeConfig = require("../../../config/runtime-config");
const AssertViewResults = require("./assert-view-results");
const { BaseStateError } = require("./errors/base-state-error");
const { AssertViewError } = require("./errors/assert-view-error");
const InvalidPngError = require("./errors/invalid-png-error");

module.exports = browser => {
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

    const { handleNoRefImage, handleImageDiff } = getCaptureProcessors();

    const assertView = async (state, selectors, opts) => {
        opts = _.defaults(opts, assertViewOpts, {
            compositeImage,
            screenshotDelay,
            tolerance,
            antialiasingTolerance,
            disableAnimation,
        });

        const { hermioneCtx } = session.executionContext;
        hermioneCtx.assertViewResults = hermioneCtx.assertViewResults || AssertViewResults.create();

        if (hermioneCtx.assertViewResults.hasState(state)) {
            return Promise.reject(new AssertViewError(`duplicate name for "${state}" state`));
        }

        const handleCaptureProcessorError = e =>
            e instanceof BaseStateError ? hermioneCtx.assertViewResults.add(e) : Promise.reject(e);

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
        const refImg = { path: config.getScreenshotPath(test, state), size: null };
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
            throw new InvalidPngError(`Reference image in ${refImg.path} is not a valid png`);
        }

        const {
            equal,
            diffBounds,
            diffClusters,
            diffImage,
            metaInfo = {},
        } = await Image.compare(refBuffer, currBuffer, imageCompareOpts);
        Object.assign(refImg, metaInfo.refImg);

        if (!equal) {
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
            };

            await fs.outputFile(currImg.path, currBuffer);

            return handleImageDiff(currImg, refImg, state, imageDiffOpts).catch(e => handleCaptureProcessorError(e));
        }

        hermioneCtx.assertViewResults.add({ stateName: state, refImg: refImg });
    };

    session.addCommand("assertView", async function (state, selectors, opts = {}) {
        await Promise.map([].concat(selectors), async selector => {
            await this.$(selector)
                .then(el => el.waitForExist())
                .catch(() => {
                    throw new Error(
                        `element ("${selector}") still not existing after ${this.options.waitforTimeout} ms`,
                    );
                });
        });

        return assertView(state, selectors, opts);
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
