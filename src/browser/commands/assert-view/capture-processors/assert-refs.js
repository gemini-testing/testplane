"use strict";

const Promise = require("bluebird");
const { ImageDiffError } = require("../errors/image-diff-error");
const { NoRefImageError } = require("../errors/no-ref-image-error");
const { InvalidRefImageError } = require("../errors/invalid-ref-image-error");

exports.handleNoRefImage = (currImg, refImg, stateName) => {
    return Promise.reject(NoRefImageError.create(stateName, currImg, refImg));
};

exports.handleInvalidRefImage = (currImg, refImg, stateName) => {
    return Promise.reject(new InvalidRefImageError(stateName, currImg, refImg));
};

exports.handleImageDiff = (currImg, refImg, stateName, opts) => {
    const {
        tolerance,
        antialiasingTolerance,
        canHaveCaret,
        diffAreas,
        config,
        diffBuffer,
        differentPixels,
        diffRatio,
    } = opts;
    const {
        buildDiffOpts,
        system: { diffColor },
    } = config;
    buildDiffOpts.ignoreCaret = buildDiffOpts.ignoreCaret && canHaveCaret;

    const diffOpts = {
        current: currImg.path,
        reference: refImg.path,
        diffColor,
        tolerance,
        antialiasingTolerance,
        ...buildDiffOpts,
    };

    return Promise.reject(
        ImageDiffError.create({
            stateName,
            currImg,
            refImg,
            diffOpts,
            diffAreas,
            diffBuffer,
            differentPixels,
            diffRatio,
        }),
    );
};
