'use strict';

const AsyncEmitter = require('../../core/events/async-emitter');
const {passthroughEvent} = require('../../core/events/utils');
const RunnerEvents = require('../constants/runner-events');
const BrowserAgent = require('./browser-agent');
const TestRunner = require('./test-runner');
const CachingTestParser = require('./caching-test-parser');
const BrowserPoolManager = require('./browser-pool/manager');

module.exports = class Runner extends AsyncEmitter {
    static create(config) {
        return new Runner(config);
    }

    constructor(config) {
        super();

        this._config = config;
        this._browserPoolManager = BrowserPoolManager.create(this._config, this);

        this._testParser = CachingTestParser.create(config);
        passthroughEvent(this._testParser, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,
            RunnerEvents.AFTER_TESTS_READ
        ]);
    }

    async runTest(fullTitle, {browserId, browserVersion, file, sessionId, sessionCaps, sessionOpts}) {
        const tests = await this._testParser.parse({file, browserId});
        const test = tests.find((t) => t.fullTitle() === fullTitle);
        const browserConfig = this._config.forBrowser(browserId);
        const browserPool = this._browserPoolManager.getPool(browserConfig);
        const browserAgent = BrowserAgent.create(browserId, browserVersion, browserPool);
        const runner = TestRunner.create(test, browserConfig, browserAgent);

        return runner.run({sessionId, sessionCaps, sessionOpts});
    }
};
