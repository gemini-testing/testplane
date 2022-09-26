'use strict';
const fs = require('fs-extra');
const _ = require('lodash');
const Image = require('../../../core/image');
const ScreenShooter = require('../../../core/screen-shooter');
const temp = require('../../../core/temp');
const { getCaptureProcessors } = require('./capture-processors');
const { getTestContext } = require('../../../utils/mocha');
const RuntimeConfig = require('../../../config/runtime-config');
const AssertViewResults = require('./assert-view-results');
const BaseStateError = require('./errors/base-state-error');
const AssertViewError = require('./errors/assert-view-error');
module.exports = (browser) => {
    const screenShooter = ScreenShooter.create(browser);
    const { publicAPI: session, config } = browser;
    const { assertViewOpts, compareOpts, compositeImage, screenshotDelay, tolerance, antialiasingTolerance } = config;
    const { handleNoRefImage, handleImageDiff } = getCaptureProcessors();
    const assertView = async (state, selectors, opts) => {
        opts = _.defaults(opts, assertViewOpts, {
            compositeImage,
            screenshotDelay,
            tolerance,
            antialiasingTolerance
        });
        const { hermioneCtx } = session.executionContext;
        hermioneCtx.assertViewResults = hermioneCtx.assertViewResults || AssertViewResults.create();
        if (hermioneCtx.assertViewResults.hasState(state)) {
            return Promise.reject(new AssertViewError(`duplicate name for "${state}" state`));
        }
        const handleCaptureProcessorError = (e) => e instanceof BaseStateError
            ? hermioneCtx.assertViewResults.add(e)
            : Promise.reject(e);
        const page = await browser.prepareScreenshot([].concat(selectors), {
            ignoreSelectors: [].concat(opts.ignoreElements),
            allowViewportOverflow: opts.allowViewportOverflow,
            captureElementFromTop: opts.captureElementFromTop,
            selectorToScroll: opts.selectorToScroll
        });
        const { tempOpts } = RuntimeConfig.getInstance();
        temp.attach(tempOpts);
        const screenshoterOpts = _.pick(opts, ['allowViewportOverflow', 'compositeImage', 'screenshotDelay', 'selectorToScroll']);
        const currImgInst = await screenShooter.capture(page, screenshoterOpts);
        const currImg = { path: temp.path(Object.assign(tempOpts, { suffix: '.png' })), size: currImgInst.getSize() };
        await currImgInst.save(currImg.path);
        const test = getTestContext(session.executionContext);
        const refImg = { path: config.getScreenshotPath(test, state), size: null };
        const { emitter } = browser;
        if (!fs.existsSync(refImg.path)) {
            return handleNoRefImage(currImg, refImg, state, { emitter }).catch((e) => handleCaptureProcessorError(e));
        }
        const { canHaveCaret, pixelRatio } = page;
        const imageCompareOpts = {
            tolerance: opts.tolerance,
            antialiasingTolerance: opts.antialiasingTolerance,
            canHaveCaret,
            pixelRatio,
            compareOpts
        };
        const { equal, diffBounds, diffClusters, metaInfo = {} } = await Image.compare(refImg.path, currImg.path, imageCompareOpts);
        Object.assign(refImg, metaInfo.refImg);
        if (!equal) {
            const diffAreas = { diffBounds, diffClusters };
            const { tolerance, antialiasingTolerance } = opts;
            const imageDiffOpts = { tolerance, antialiasingTolerance, canHaveCaret, diffAreas, config, emitter };
            return handleImageDiff(currImg, refImg, state, imageDiffOpts).catch((e) => handleCaptureProcessorError(e));
        }
        hermioneCtx.assertViewResults.add({ stateName: state, refImg: refImg });
    };
    session.addCommand('assertView', async function (state, selectors, opts = {}) {
        return assertView(state, selectors, opts);
    });
    session.addCommand('assertView', async function (state, opts = {}) {
        return assertView(state, this.selector, opts);
    }, true);
};
