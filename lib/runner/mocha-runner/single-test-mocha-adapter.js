'use strict';

/**
 * MochaAdapter decorator
 * Level of abstraction which implements a mocha adapter with one single test
 */
module.exports = class SingleTestMochaAdapter {
    static create(mocha, filename, index) {
        return new SingleTestMochaAdapter(mocha, filename, index);
    }

    constructor(mocha, filename, index) {
        this._mocha = mocha;
        this._filename = filename;
        this._index = index;

        this._loadTest();
    }

    get tests() {
        return this._mocha.tests;
    }

    get suite() {
        return this._mocha.suite;
    }

    run() {
        return this._mocha.run();
    }

    reinit() {
        this._mocha.reinit();

        this._loadTest();
    }

    _loadTest() {
        let currentTestIndex = -1;

        return this._mocha
            .attachTestFilter(() => ++currentTestIndex === this._index)
            .loadFiles(this._filename);
    }

    on() {
        return this._mocha.on.apply(this._mocha, arguments);
    }
};
