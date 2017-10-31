'use strict';

const _ = require('lodash');
const AsyncEmitter = require('gemini-core').events.AsyncEmitter;
const eventsUtils = require('gemini-core').events.utils;
const BrowserPool = require('../browser-pool');
const RunnerEvents = require('../constants/runner-events');
const MochaRunner = require('./mocha-runner');

module.exports = class MainRunner extends AsyncEmitter {
    static create(config) {
        return new MainRunner(config);
    }

    constructor(config) {
        super();

        this._config = config;
        this._browserPool = BrowserPool.create(this._config, this);

        MochaRunner.prepare();
    }

    init(testPaths) {
        this._mochaRunners = _.mapValues(testPaths, (files, browserId) => {
            return this._createMochaRunner(browserId).init(files);
        });
    }

    _createMochaRunner(browserId) {
        const mochaRunner = MochaRunner.create(browserId, this._config, this._browserPool);

        eventsUtils.passthroughEvent(mochaRunner, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,

            RunnerEvents.NEW_BROWSER
        ]);

        return mochaRunner;
    }

    runTest(fullTitle, options) {
        return this._mochaRunners[options.browserId].runTest(fullTitle, options.sessionId);
    }
};
