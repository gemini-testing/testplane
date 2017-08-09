'use strict';

const BaseSingleTestMochaAdapter = require('./base-single-test-mocha-adapter');

module.exports = class SingleTestMochaAdapter extends BaseSingleTestMochaAdapter {
    run(workers) {
        return this._mocha.run(workers);
    }

    reinit() {
        this._mocha.reinit();

        this._loadTest();
    }

    on() {
        return this._mocha.on.apply(this._mocha, arguments);
    }
};
