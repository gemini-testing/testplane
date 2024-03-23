import fs from "fs-extra";
import _ from "lodash";
import Promise from "bluebird";
import { pngValidator as validatePng } from "png-validator";

import Image from "../../../image.js";
import ScreenShooter from "../../screen-shooter/index.js";
import temp from "../../../temp.js";
import { getCaptureProcessors } from "./capture-processors/index.js";
import RuntimeConfig from "../../../config/runtime-config.js";
import AssertViewResults from "./assert-view-results.js";
import { BaseStateError } from "./errors/base-state-error.js";
import { AssertViewError } from "./errors/assert-view-error.js";
import InvalidPngError from "./errors/invalid-png-error.js";

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

export default browser => {
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
