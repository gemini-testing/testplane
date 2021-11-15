import Bluebird from 'bluebird';

import ImageDiffError from '../errors/image-diff-error';
import NoRefImageError from '../errors/no-ref-image-error';

import type { Image } from 'gemini-core';

export const handleNoRefImage = (currImg: Image, refImg: Image, state) => {
    return Bluebird.reject(NoRefImageError.create(state, currImg, refImg));
};

export const handleImageDiff = (currImg: Image, refImg: Image, state, opts) => {
    const {tolerance, antialiasingTolerance, canHaveCaret, diffAreas, config} = opts;
    const {buildDiffOpts, system: {diffColor}} = config;
    buildDiffOpts.ignoreCaret = buildDiffOpts.ignoreCaret && canHaveCaret;

    const diffOpts = {
        current: currImg.path, reference: refImg.path,
        diffColor, tolerance, antialiasingTolerance, ...buildDiffOpts
    };

    return Bluebird.reject(ImageDiffError.create(state, currImg, refImg, diffOpts, diffAreas));
};
