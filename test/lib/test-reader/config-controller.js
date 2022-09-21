'use strict';

const configController = require('build/test-reader/config-controller');

describe('test-reader/config-controller', () => {
    describe('testTimeout', () => {
        it('should set timeout for passed runnable', () => {
            const runnable = {
                timeout: sinon.stub().named('timeout')
            };

            configController.testTimeout.call(runnable, 100500);

            assert.calledOnceWith(runnable.timeout, 100500);
        });
    });
});
