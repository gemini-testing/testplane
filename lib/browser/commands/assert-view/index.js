'use strict';

const fs = require('fs-extra');
const _ = require('lodash');
const {Image, temp, ScreenShooter} = require('gemini-core');
const {getCaptureProcessors} = require('./capture-processors');
const {getTestContext} = require('../../../utils/mocha');
const RuntimeConfig = require('../../../config/runtime-config');
const AssertViewResults = require('./assert-view-results');
const BaseStateError = require('./errors/base-state-error');
const AssertViewError = require('./errors/assert-view-error');

module.exports = (browser) => {
    const screenShooter = ScreenShooter.create(browser);
    const {publicAPI: session, config} = browser;
    const {tolerance, antialiasingTolerance, compareOpts, screenshotDelay} = config;

    const {handleNoRefImage, handleImageDiff} = getCaptureProcessors();

    session.addCommand('assertView', async (state, selectors, opts = {}) => {
        opts = _.defaults(opts, {
            ignoreElements: [],
            tolerance,
            allowViewportOverflow: false,
            insideViewport: false,
            screenshotDelay
        });

        const {hermioneCtx} = session.executionContext;
        hermioneCtx.assertViewResults = hermioneCtx.assertViewResults || AssertViewResults.create();

        if (hermioneCtx.assertViewResults.hasState(state)) {
            return Promise.reject(new AssertViewError(`duplicate name for "${state}" state`));
        }

        const handleCaptureProcessorError = (e) => e instanceof BaseStateError
            ? hermioneCtx.assertViewResults.add(e)
            : Promise.reject(e);

        const {allowViewportOverflow, insideViewport} = opts;
        const page = await browser.prepareScreenshot(
            [].concat(selectors),
            {
                ignoreSelectors: [].concat(opts.ignoreElements),
                allowViewportOverflow: allowViewportOverflow || insideViewport
            }
        );

        const {tempOpts} = RuntimeConfig.getInstance();
        temp.attach(tempOpts);

        const screenShooterOpts = {
            screenshotDelay: opts.screenshotDelay,
            insideViewport,
            allowViewportOverflow
        };

        const currImgInst = await screenShooter.capture(page, screenShooterOpts);
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
            antialiasingTolerance,
            canHaveCaret,
            pixelRatio,
            compareOpts
        };
        const {equal, diffBounds, diffClusters, metaInfo = {}} = await Image.compare(refImg.path, currImg.path, imageCompareOpts);
        Object.assign(refImg, metaInfo.refImg);

        if (!equal) {
            const diffAreas = {diffBounds, diffClusters};
            const opts = {canHaveCaret, diffAreas, config, emitter};

            return handleImageDiff(currImg, refImg, state, opts).catch((e) => handleCaptureProcessorError(e));
        }

        hermioneCtx.assertViewResults.add({stateName: state, refImg: refImg});
    });
};
