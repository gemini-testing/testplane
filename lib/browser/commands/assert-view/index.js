'use strict';

const fs = require('fs');
const {Image, temp} = require('gemini-core');
const {getCaptureProcessors} = require('./capture-processors');
const {getTestContext} = require('../../../utils/mocha');
const RuntimeConfig = require('../../../config/runtime-config');

module.exports = (browser) => {
    const {publicAPI: session, config} = browser;
    const {tolerance} = config;

    const {handleNoRefImage, handleImageDiff} = getCaptureProcessors();

    session.addCommand('assertView', (state) => {
        const test = getTestContext(session.executionContext);
        const refPath = config.getScreenshotPath(test, state);
        const tempOpts = RuntimeConfig.getInstance().tempOpts;

        temp.attach(tempOpts);
        const currPath = temp.path(Object.assign(tempOpts, {suffix: '.png'}));

        return browser.captureViewportImage()
            .then((currImage) => currImage.save(currPath))
            .then(() => {
                if (!fs.existsSync(refPath)) {
                    return handleNoRefImage(currPath, refPath, state);
                }

                return Image.compare(refPath, currPath, {tolerance})
                    .then((isEqual) => {
                        if (!isEqual) {
                            return handleImageDiff(currPath, refPath, state, config);
                        }
                    });
            });
    });
};
