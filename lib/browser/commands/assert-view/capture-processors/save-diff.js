'use strict';

const crypto = require('crypto');
const fs = require('fs-extra');

const Promise = require('bluebird');
const {Image} = require('gemini-core');

// Need to cache the result of 'Image.buildDiff' because it is slow.
const globalCache = new Map();

exports.saveDiff = async (curPath, refPath, diffPath, diffOpts, cache = globalCache) => {
    const [curBuffer, refBuffer] = await Promise.all([
        fs.readFile(curPath),
        fs.readFile(refPath)
    ]);

    const hash = createHash(curBuffer) + createHash(refBuffer);

    if (cache.has(hash)) {
        return cache.get(hash);
    }

    const diffBuffer = await Image.buildDiff({
        ...diffOpts,
        current: curBuffer,
        reference: refBuffer
    });

    await fs.writeFile(diffPath, diffBuffer);

    cache.set(hash, diffPath);

    return diffPath;
};

function createHash(buffer) {
    return crypto
        .createHash('sha1')
        .update(buffer)
        .digest('base64');
}
