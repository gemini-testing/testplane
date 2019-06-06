'use strict';

const Promise = require('bluebird');
const ImageDiffError = require('../errors/image-diff-error');
const NoRefImageError = require('../errors/no-ref-image-error');

exports.handleNoRefImage = (currImg, refImg, state) => {
    return Promise.reject(NoRefImageError.create(state, currImg, refImg));
};

exports.handleImageDiff = (currImg, refImg, state, opts) => {
    const {canHaveCaret, diffAreas, config} = opts;
    const {tolerance, antialiasingTolerance, buildDiffOpts, system: {diffColor}} = config;
    buildDiffOpts.ignoreCaret = buildDiffOpts.ignoreCaret && canHaveCaret;

    const diffOpts = {
        current: currImg.path, reference: refImg.path,
        diffColor, tolerance, antialiasingTolerance, ...buildDiffOpts
    };

    return Promise.reject(ImageDiffError.create(state, currImg, refImg, diffOpts, diffAreas));
};
