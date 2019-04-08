'use strict';

const _ = require('lodash');
const BaseStateError = require('lib/browser/commands/assert-view/errors/base-state-error');
const ImageDiffError = require('lib/browser/commands/assert-view/errors/image-diff-error');

const mkImageDiffError = (opts = {}) => {
    const {stateName, currImg, refImg, diffOpts} = _.defaults(opts, {
        stateName: 'default-name',
        currImg: {path: '/default-curr/path'},
        refImg: {path: '/default-ref/path'}
    });

    return new ImageDiffError(stateName, currImg, refImg, diffOpts);
};

describe('ImageDiffError', () => {
    it('should be an instance of "BaseStateError"', () => {
        assert.instanceOf(mkImageDiffError(), BaseStateError);
    });

    it('should be eventually an instance of Error', () => {
        assert.instanceOf(mkImageDiffError(), Error);
    });

    it('should contain a state name in an error message', () => {
        const error = mkImageDiffError({stateName: 'plain'});

        assert.match(error.message, /images are different for "plain" state/);
    });

    it('should contain a state name', () => {
        const error = mkImageDiffError({stateName: 'plain'});

        assert.equal(error.stateName, 'plain');
    });

    it('should contain a current image', () => {
        const error = mkImageDiffError({currImg: {path: '/curr/path'}});

        assert.deepEqual(error.currImg, {path: '/curr/path'});
    });

    it('should contain a reference image', () => {
        const error = mkImageDiffError({refImg: {path: '/ref/path'}});

        assert.deepEqual(error.refImg, {path: '/ref/path'});
    });

    it('should create an instance of error from object', () => {
        const error = ImageDiffError.fromObject({
            stateName: 'name',
            currImg: {path: 'curr/path'},
            refImg: {path: 'ref/path'}
        });

        assert.instanceOf(error, ImageDiffError);
        assert.deepInclude(Object.assign({}, error), {
            stateName: 'name',
            currImg: {path: 'curr/path'},
            refImg: {path: 'ref/path'}
        });
    });
});
