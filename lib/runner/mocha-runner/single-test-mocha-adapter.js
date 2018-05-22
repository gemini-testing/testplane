'use strict';

/**
 * MochaAdapter decorator
 * Level of abstraction which implements a mocha adapter with one single test
 */

const {Test} = require('mocha');

module.exports = class SingleTestMochaAdapter {
    static create(mocha, source, index) {
        return new SingleTestMochaAdapter(mocha, source, index);
    }

    constructor(mocha, source, index) {
        this._mocha = mocha;
        this._source = source;
        this._index = index;
        this._handleTest = source instanceof Test ? this._useTest : this._loadTest;

        this._handleTest();
    }

    get tests() {
        return this._mocha.tests;
    }

    get suite() {
        return this._mocha.suite;
    }

    run(workers) {
        return this._mocha.run(workers);
    }

    reinit() {
        this._mocha.reinit();

        this._handleTest();
    }

    _loadTest() {
        let currentTestIndex = -1;

        this._mocha
            .attachTestFilter(() => ++currentTestIndex === this._index)
            .loadFiles(this._source);
    }

    _useTest() {
        this._mocha.useTest(this._source);
    }

    on() {
        return this._mocha.on.apply(this._mocha, arguments);
    }
};
