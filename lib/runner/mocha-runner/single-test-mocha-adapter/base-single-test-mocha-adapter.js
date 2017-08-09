'use strict';

/**
 * MochaAdapter decorator
 * Level of abstraction which implements a mocha adapter with one single test
 */
module.exports = class BaseSingleTestMochaAdapter {
    static create(mocha, filename, index) {
        return new this(mocha, filename, index);
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

    _loadTest() {
        let currentTestIndex = -1;

        return this._mocha
            .attachTestFilter(() => ++currentTestIndex === this._index)
            .loadFiles(this._filename);
    }

    disableHooksInSkippedSuites() {
        return this._mocha.disableHooksInSkippedSuites();
    }
};
