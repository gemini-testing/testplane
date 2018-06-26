'use strict';

const eventsUtils = require('gemini-core').events.utils;

const RunnerEvents = require('./constants/runner-events');
const Runner = require('./runner');
const BaseHermione = require('../base-hermione');
const TestCollection = require('../test-collection');

module.exports = class Hermione extends BaseHermione {
    constructor(configPath) {
        super(configPath);

        this._runner = Runner.create(this._config);

        eventsUtils.passthroughEvent(this._runner, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,

            RunnerEvents.NEW_BROWSER
        ]);

        this._runner.on(RunnerEvents.AFTER_FILE_READ, (data) => {
            const tests = [];
            data.suite.eachTest((t) => tests.push(t));

            this.emit(RunnerEvents.AFTER_TESTS_READ, TestCollection.create({[data.browser]: tests}));
        });
    }

    init() {
        return this._init();
    }

    runTest(fullTitle, options) {
        return this._runner.runTest(fullTitle, options);
    }

    isWorker() {
        return true;
    }
};
