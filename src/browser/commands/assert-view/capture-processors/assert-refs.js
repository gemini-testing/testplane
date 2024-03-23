import Promise from "bluebird";
import { ImageDiffError } from "../errors/image-diff-error.js";
import { NoRefImageError } from "../errors/no-ref-image-error.js";

export const handleNoRefImage = (currImg, refImg, stateName) => {
    return Promise.reject(NoRefImageError.create(stateName, currImg, refImg));
};

export const handleImageDiff = (currImg, refImg, stateName, opts) => {
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
