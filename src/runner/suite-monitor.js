"use strict";

const { EventEmitter } = require("events");
const { MasterEvents } = require("../events");

module.exports = class SuiteMonitor extends EventEmitter {
    static create() {
        return new SuiteMonitor();
    }

    constructor() {
        super();

        this._suites = new Map();
    }

    testBegin(test) {
        this._addTest(test.parent);
    }

    _addTest(suite) {
        if (suite.root) {
            return;
        }

        this._addTest(suite.parent);

        if (!this._suites.has(suite)) {
            this.emit(MasterEvents.SUITE_BEGIN, suite);
            this._suites.set(suite, { runningTests: 1, retries: 0 });
        } else {
            const suiteInfo = this._suites.get(suite);
            ++suiteInfo.runningTests;
            if (suiteInfo.retries > 0) {
                --suiteInfo.retries;
            }
        }
    }

    testEnd(test) {
        this._rmTest(test.parent);
    }

    _rmTest(suite) {
        if (suite.root) {
            return;
        }

        const suiteInfo = this._suites.get(suite);
        if (--suiteInfo.runningTests === 0 && suiteInfo.retries === 0) {
            this._suites.delete(suite);
            this.emit(MasterEvents.SUITE_END, suite);
        }

        this._rmTest(suite.parent);
    }

    testRetry(test) {
        this._addRetry(test.parent);
    }

    _addRetry(suite) {
        if (suite.root) {
            return;
        }

        ++this._suites.get(suite).retries;

        this._addRetry(suite.parent);
    }
};
