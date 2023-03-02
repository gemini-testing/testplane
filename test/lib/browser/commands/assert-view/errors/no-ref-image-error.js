'use strict';

const _ = require('lodash');
const BaseStateError = require('src/browser/commands/assert-view/errors/base-state-error');
const NoRefImageError = require('src/browser/commands/assert-view/errors/no-ref-image-error');

const mkNoRefImageError = (opts = {}) => {
    const {stateName, currImg, refImg} = _.defaults(opts, {
        stateName: 'default-name',
        currImg: {path: '/default-curr/path'},
        refImg: {path: '/default-ref/path'}
    });

    return new NoRefImageError(stateName, currImg, refImg);
};

describe('NoRefImageError', () => {
    it('should be an instance of "BaseStateError"', () => {
        assert.instanceOf(mkNoRefImageError(), BaseStateError);
    });

    it('should be eventually an instance of Error', () => {
        assert.instanceOf(mkNoRefImageError(), Error);
    });

    it('should contain a state name', () => {
        const error = mkNoRefImageError({stateName: 'plain'});

        assert.equal(error.stateName, 'plain');
    });

    it('should contain a current image', () => {
        const error = mkNoRefImageError({currImg: {path: '/curr/path'}});

        assert.deepEqual(error.currImg, {path: '/curr/path'});
    });

    it('should contain a reference image', () => {
        const error = mkNoRefImageError({refImg: {path: '/ref/path'}});

        assert.deepEqual(error.refImg, {path: '/ref/path'});
    });

    it('should contain state name and reference image path in an error message', () => {
        const error = mkNoRefImageError({stateName: 'plain', refImg: {path: '/ref/path'}});

        assert.match(error.message, /reference image at \/ref\/path for "plain" state/);
    });

    it('should create an instance of error from object', () => {
        const error = NoRefImageError.fromObject({
            stateName: 'name',
            currImg: {path: '/curr/path'},
            refImg: {path: '/ref/path'}
        });

        assert.instanceOf(error, NoRefImageError);
        assert.deepInclude(Object.assign({}, error), {
            stateName: 'name',
            currImg: {path: '/curr/path'},
            refImg: {path: '/ref/path'}
        });
    });
});
