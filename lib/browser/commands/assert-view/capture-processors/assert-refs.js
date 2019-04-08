'use strict';

const ImageDiffError = require('../errors/image-diff-error');
const NoRefImageError = require('../errors/no-ref-image-error');
const {saveDiff} = require('./save-diff');

exports.handleNoRefImage = (currImg, refImg, state) => {
    return Promise.reject(NoRefImageError.create(state, currImg, refImg));
};

exports.handleImageDiff = async (currImg, refImg, diffImg, state, opts) => {
    const {diffAreas, config} = opts;
    const {tolerance, antialiasingTolerance, buildDiffOpts, system: {diffColor}} = config;

    const diffOpts = {
        diffColor, tolerance, antialiasingTolerance, ...buildDiffOpts
    };

    diffImg.path = await saveDiff(currImg.path, refImg.path, diffImg.path, diffOpts);

    const error = ImageDiffError.create(state, currImg, refImg, diffImg, diffAreas);

    return Promise.reject(error);
};
