'use strict';

const _ = require('lodash');

module.exports = class SuiteCollection {
    static create(suiteTree) {
        return new SuiteCollection(suiteTree);
    }

    constructor(suiteTree = {}) {
        this._suiteTree = suiteTree;
        this._testsByBro = _.mapValues(suiteTree, (suite) => {
            const tests = [];
            suite.eachTest((test) => tests.push(test));

            return tests;
        });
    }

    get suiteTree() {
        return this._suiteTree;
    }

    getTests() {
        if (this._tests) {
            return this._tests;
        }

        return this._tests = _(this.getTestsByBro()).values().flatten().value();
    }

    getTestsByBro() {
        if (this._testsByBro) {
            return this._testsByBro;
        }

        return this._testsByBro = _.mapValues(this._suiteTree, (suite) => {
            const tests = [];
            suite.eachTest((test) => tests.push(test));

            return tests;
        });
    }

    getEnabledTestsByBro() {
        return _(this.getTestsByBro())
            .mapValues((tests) => _.reject(tests, 'enable'))
            .omitBy(_.isEmpty)
            .value();
    }

    disableAll() {
        this.getTests().forEach(this._disableEntity);
    }

    enableAll() {
        this.getTests().forEach(this._enableEntity);
    }

    disable(testId, browserId) {
        this._disableEntity(this._findTest(testId, browserId));
    }

    enable(testId, browserId) {
        this._enableEntity(this._findTest(testId, browserId));
    }

    _findTest(testId, browserId) {
        const testsByBro = this.getTestsByBro()[browserId] || [];
        const test = testsByBro.find((test) => test.id() === testId);

        if (!test) {
            throw new Error(`No such test with id ${testId} in browser ${browserId}`);
        }

        return test;
    }

    _disableEntity(test) {
        _.extend(test, {enable: true});
    }

    _enableEntity(test) {
        _.extend(test, {enable: false});
    }
};
