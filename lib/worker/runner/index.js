'use strict';

const AsyncEmitter = require('../../core/events/async-emitter');
const {passthroughEvent} = require('../../core/events/utils');
const RunnerEvents = require('../constants/runner-events');
const BrowserPool = require('./browser-pool');
const BrowserAgent = require('./browser-agent');
const TestRunner = require('./test-runner');
const CachingTestParser = require('./caching-test-parser');

module.exports = class Runner extends AsyncEmitter {
    static create(config) {
        return new Runner(config);
    }

    constructor(config) {
        super();

        this._config = config;
        this._browserPool = BrowserPool.create(this._config, this);

        this._testParser = CachingTestParser.create(config);
        passthroughEvent(this._testParser, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,
            RunnerEvents.AFTER_TESTS_READ
        ]);
    }

    runTest(fullTitle, {browserId, browserVersion, file, sessionId, sessionCaps, sessionOpts}) {
        const tests = this._testParser.parse({file, browserId});
        const test = tests.find((t) => t.fullTitle() === fullTitle);
        const browserAgent = BrowserAgent.create(browserId, browserVersion, this._browserPool);
        const runner = TestRunner.create(test, this._config.forBrowser(browserId), browserAgent);

        return runner.run({sessionId, sessionCaps, sessionOpts});
    }
};
