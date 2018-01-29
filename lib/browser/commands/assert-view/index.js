'use strict';

const fs = require('fs');
const {Image, temp} = require('gemini-core');
const {getCaptureProcessors} = require('./capture-processors');
const {getTestContext} = require('../../../utils/mocha');

module.exports = (browser) => {
    const {publicAPI: session, config} = browser;
    const {tolerance} = config;
    const {system: {tempDir}} = config;

    temp.init(tempDir);

    const {handleNoRefImage, handleImageDiff} = getCaptureProcessors();

    session.addCommand('assertView', (state) => {
        const test = getTestContext(session.executionContext);
        const refPath = config.getScreenshotPath(test, state);
        const currPath = temp.path({suffix: '.png'});

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
