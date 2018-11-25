'use strict';

const Promise = require('bluebird');
const ImageDiffError = require('../errors/image-diff-error');
const NoRefImageError = require('../errors/no-ref-image-error');

exports.handleNoRefImage = (currPath, refPath, state) => {
    return Promise.reject(new NoRefImageError(state, currPath, refPath));
};

exports.handleImageDiff = (currPath, refPath, state, opts) => {
    const {diffBounds, config} = opts;
    const {tolerance, system: {diffColor}} = config;

    const diffOpts = {reference: refPath, current: currPath, diffColor, tolerance};
    return Promise.reject(new ImageDiffError(state, currPath, refPath, diffBounds, diffOpts));
};
