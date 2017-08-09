'use strict';

const BaseSingleTestMochaAdapter = require('../../../runner/mocha-runner/single-test-mocha-adapter/base-single-test-mocha-adapter');

module.exports = class SingleTestMochaAdapter extends BaseSingleTestMochaAdapter {
    runInSession(sessionId) {
        return this._mocha.runInSession(sessionId);
    }
};
