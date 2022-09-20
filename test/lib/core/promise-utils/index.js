'use strict';

const Promise = require('bluebird');
const utils = require('lib/core/promise-utils');

describe('promise-utils', () => {
    describe('waitForResults', () => {
        it('should return fulfilled promise if no promises passed', () => {
            return assert.isFulfilled(utils.waitForResults([]));
        });

        it('should wait until all promises resolved', () => {
            const first = Promise.delay(1);
            const second = Promise.delay(2);

            return utils.waitForResults([first, second])
                .then(() => Promise.all([
                    assert.isFulfilled(first),
                    assert.isFulfilled(second)
                ]));
        });

        it('should reject with first error if any of passed promises rejected', () => {
            const resolved = Promise.resolve();
            const rejected1 = Promise.reject('foo');
            const rejected2 = Promise.reject('bar');

            return assert.isRejected(utils.waitForResults([resolved, rejected1, rejected2]), /foo/);
        });

        it('should not immediately reject when any of promises is rejected', () => {
            const first = Promise.reject();
            const second = Promise.delay(10);

            return utils.waitForResults([first, second])
                .catch(() => {
                    assert.isTrue(first.isRejected());
                    assert.isTrue(second.isFulfilled());
                });
        });
    });
});
