'use strict';

module.exports = class SuiteSubset {
    static create(...args) {
        return new this(...args);
    }

    constructor(suite, file) {
        this._suite = suite;
        this.file = file;

        this._suitesIdx = suite.suites.length;
        this._testsIdx = suite.tests.length;

        this._suites = [];
        this._tests = [];

        const onSuite = (suite) => this._suites.push(suite);
        const onTest = (test) => this._tests.push(test);

        const cleanUp = () => {
            this._suite.removeListener('suite', onSuite);
            this._suite.removeListener('test', onTest);
            this._suite.removeListener('post-require', cleanUp);
        };

        this._suite.on('suite', onSuite);
        this._suite.on('test', onTest);
        this._suite.on('post-require', cleanUp);
    }

    prependListener(event, cb) {
        this._addListener(event, cb, 'prependListener');
    }

    on(event, cb) {
        this._addListener(event, cb, 'on');
    }

    _addListener(event, cb, method) {
        this._suite[method](event, cb);

        const cleanUp = () => {
            this._suite.removeListener(event, cb);
            this._suite.removeListener('post-require', cleanUp);
        };

        this._suite.on('post-require', cleanUp);
    }

    get suites() {
        return this._suites;
    }

    set suites(suites) {
        this._suite.suites.splice(this._suitesIdx, this._suites.length, ...suites);
        this._suites = suites;
    }

    get tests() {
        return this._tests;
    }

    set tests(tests) {
        this._suite.tests.splice(this._testsIdx, this._tests.length, ...tests);
        this._tests = tests;
    }

    fullTitle() {
        return this._suite.fullTitle();
    }

    set pending(val) {
        this.suites.forEach((s) => s.pending = val);
        this.tests.forEach((t) => t.pending = val);
    }

    set silentSkip(val) {
        this.suites.forEach((s) => s.silentSkip = val);
        this.tests.forEach((t) => t.silentSkip = val);
    }

    eachTest(cb) {
        this._suites.forEach((s) => s.eachTest(cb));
        this._tests.forEach(cb);
    }

    beforeEach() {}
    afterEach() {}

    get _afterEach() {
        return [];
    }
};
