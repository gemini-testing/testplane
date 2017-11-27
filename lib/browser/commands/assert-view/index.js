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

        return takeScreenshot(session, currPath)
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

                const diffOpts = {refPath, currPath, diffColor, tolerance};
                const buildDiff = (diffPath) => Image.buildDiff(Object.assign(diffOpts, {diffPath}));

                throw new ImageDiffError(state, currPath, refPath, buildDiff);
            });
    });
};

function takeScreenshot(session, imagePath) {
    return session.screenshot()
        .then((screenData) => Image.fromBase64(screenData.value))
        .then((currImage) => currImage.save(imagePath));
}
