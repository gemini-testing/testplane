'use strict';

const fs = require('fs');
const {Image, temp} = require('gemini-core');
const ImageDiffError = require('./errors/image-diff-error');
const NoRefImageError = require('./errors/no-ref-image-error');
const {getTestContext} = require('../../../utils/mocha');

module.exports = (browser) => {
    const {publicAPI: session, config} = browser;
    const {tolerance} = config;
    const {system: {diffColor, tempDir}} = config;

    temp.init(tempDir);

    session.addCommand('assertView', (state) => {
        const test = getTestContext(session.executionContext);
        const refPath = config.getScreenshotPath(test, state);
        const currPath = temp.path({suffix: '.png'});

        return browser.captureViewportImage()
            .then((currImage) => currImage.save(currPath))
            .then(() => {
                if (!fs.existsSync(refPath)) {
                    throw new NoRefImageError(state, currPath, refPath);
                }
            })
            .then(() => Image.compare(refPath, currPath, {tolerance}))
            .then((isEqual) => {
                if (isEqual) {
                    return browser;
                }

                const diffOpts = {reference: refPath, current: currPath, diffColor, tolerance};
                throw new ImageDiffError(state, currPath, refPath, diffOpts);
            });
    });
};
