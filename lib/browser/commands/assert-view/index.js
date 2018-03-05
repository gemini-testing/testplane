'use strict';

const fs = require('fs');
const {Image, temp, Viewport} = require('gemini-core');
const {getCaptureProcessors} = require('./capture-processors');
const {getTestContext} = require('../../../utils/mocha');
const RuntimeConfig = require('../../../config/runtime-config');

module.exports = (browser) => {
    const {publicAPI: session, config} = browser;
    const {tolerance} = config;

    const {handleNoRefImage, handleImageDiff} = getCaptureProcessors();

    session.addCommand('assertView', (state, selectors) => {
        const test = getTestContext(session.executionContext);
        const refPath = config.getScreenshotPath(test, state);
        const tempOpts = RuntimeConfig.getInstance().tempOpts;

        temp.attach(tempOpts);
        const currPath = temp.path(Object.assign(tempOpts, {suffix: '.png'}));

        return browser.prepareScreenshot([].concat(selectors))
            .then((page) => {
                return browser.captureViewportImage(page)
                    .then((viewportImage) => Viewport.create(page.viewport, viewportImage, page.pixelRatio))
                    .then((viewport) => cropImage(viewport, page.captureArea))
                    .then((currImage) => currImage.save(currPath))
                    .then(() => {
                        if (!fs.existsSync(refPath)) {
                            return handleNoRefImage(currPath, refPath, state);
                        }

                        return Image.compare(refPath, currPath, {tolerance, canHaveCaret: page.canHaveCaret})
                            .then((isEqual) => {
                                if (!isEqual) {
                                    return handleImageDiff(currPath, refPath, state, config);
                                }
                            });
                    });
            });
    });

    function cropImage(viewport, captureArea) {
        viewport.validate(captureArea, browser);

        return viewport.crop(captureArea);
    }
};
