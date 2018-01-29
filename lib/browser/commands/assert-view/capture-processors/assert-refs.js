'use strict';

const ImageDiffError = require('../errors/image-diff-error');
const NoRefImageError = require('../errors/no-ref-image-error');

exports.handleNoRefImage = (currPath, refPath, state) => {
    throw new NoRefImageError(state, currPath, refPath);
};

exports.handleImageDiff = (currPath, refPath, state, config) => {
    const {tolerance} = config;
    const {system: {diffColor}} = config;

    const diffOpts = {reference: refPath, current: currPath, diffColor, tolerance};
    throw new ImageDiffError(state, currPath, refPath, diffOpts);
};
