import fs from 'fs-extra';
import _ from 'lodash';
import { Image, temp, ScreenShooter } from 'gemini-core';
import { getCaptureProcessors } from './capture-processors';
import { getTestContext } from '../../../utils/mocha';
import * as RuntimeConfig from '../../../config/runtime-config';
import AssertViewResults from './assert-view-results';
import BaseStateError from './errors/base-state-error';
import AssertViewError from './errors/assert-view-error';

import type ExistingBrowser from "../../existing-browser";

export default (browser: ExistingBrowser) => {
    const screenShooter = ScreenShooter.create(browser);
    const {publicAPI: session, config} = browser;
    const {assertViewOpts, compareOpts, compositeImage, screenshotDelay, tolerance, antialiasingTolerance} = config;

    const {handleNoRefImage, handleImageDiff} = getCaptureProcessors();

    session.addCommand('assertView', async (state, selectors, opts = {}) => {
        opts = _.defaults(opts, assertViewOpts, {
            compositeImage,
            screenshotDelay,
            tolerance,
            antialiasingTolerance
        });

        const {hermioneCtx} = session.executionContext;
        hermioneCtx.assertViewResults = hermioneCtx.assertViewResults || AssertViewResults.create();

        if (hermioneCtx.assertViewResults.hasState(state)) {
            return Promise.reject(new AssertViewError(`duplicate name for "${state}" state`));
        }

        const handleCaptureProcessorError = (e) => e instanceof BaseStateError
            ? hermioneCtx.assertViewResults.add(e)
            : Promise.reject(e);

        const page = await browser.prepareScreenshot(
            [].concat(selectors),
            {
                ignoreSelectors: [].concat(opts.ignoreElements),
                allowViewportOverflow: opts.allowViewportOverflow,
                captureElementFromTop: opts.captureElementFromTop,
                selectorToScroll: opts.selectorToScroll
            }
        );

        const {tempOpts} = RuntimeConfig.getInstance();
        temp.attach(tempOpts);

        const screenshoterOpts = _.pick(
            opts,
            ['allowViewportOverflow', 'compositeImage', 'screenshotDelay', 'selectorToScroll']
        );
        const currImgInst = await screenShooter.capture(page, screenshoterOpts);
        const currImg = {path: temp.path(Object.assign(tempOpts, {suffix: '.png'})), size: currImgInst.getSize()};
        await currImgInst.save(currImg.path);

        const test = getTestContext(session.executionContext);
        const refImg = {path: config.getScreenshotPath(test, state), size: null};
        const {emitter} = browser;

        if (!fs.existsSync(refImg.path)) {
            return handleNoRefImage(currImg, refImg, state, {emitter}).catch((e) => handleCaptureProcessorError(e));
        }

        const {canHaveCaret, pixelRatio} = page;
        const imageCompareOpts = {
            tolerance: opts.tolerance,
            antialiasingTolerance: opts.antialiasingTolerance,
            canHaveCaret,
            pixelRatio,
            compareOpts
        };
        const {equal, diffBounds, diffClusters, metaInfo = {}} = await Image.compare(refImg.path, currImg.path, imageCompareOpts);
        Object.assign(refImg, metaInfo.refImg);

        if (!equal) {
            const diffAreas = {diffBounds, diffClusters};
            const {tolerance, antialiasingTolerance} = opts;
            const imageDiffOpts = {tolerance, antialiasingTolerance, canHaveCaret, diffAreas, config, emitter};

            return handleImageDiff(currImg, refImg, state, imageDiffOpts).catch((e) => handleCaptureProcessorError(e));
        }

        hermioneCtx.assertViewResults.add({stateName: state, refImg: refImg});
    });
};
