'use strict';

const {EventEmitter} = require('events');
const RunnerEvents = require('./constants/runner-events');

module.exports = class SuiteMonitor extends EventEmitter {
    static create() {
        return new SuiteMonitor();
    }

    constructor() {
        super();

        this._counter = {};
    }

    suiteBegin(suite) {
        const id = suite.id();

        if (!this._counter[id]) {
            this._counter[id] = {count: 1};
            this.emit(RunnerEvents.SUITE_BEGIN, suite);
        } else {
            ++this._counter[id].count;
        }

        this._counter[id].retried = false;
    }

    suiteEnd(suite) {
        const id = suite.id();
        --this._counter[id].count;

        if (this._counter[id].count === 0 && !this._counter[id].retried) {
            this.emit(RunnerEvents.SUITE_END, suite);
        }
    }

    testRetry({parent}) {
        if (parent.root) {
            return;
        }

        const id = parent.id();
        this._counter[id].retried = true;
        this.testRetry(parent);
    }
};
