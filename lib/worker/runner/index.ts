import { events } from 'gemini-core';

import BrowserAgent from './browser-agent';
import BrowserPool from './browser-pool';
import CachingTestParser from './caching-test-parser';
import TestRunner from './test-runner';
import RunnerEvents from '../constants/runner-events';

import type Config from '../../config';

export default class Runner extends events.AsyncEmitter {
    private _config: Config;
    private _browserPool: BrowserPool;
    private _testParser: CachingTestParser;

    public static create(config: Config): Runner {
        return new Runner(config);
    }

    constructor(config: Config) {
        super();

        this._config = config;
        this._browserPool = BrowserPool.create(this._config, this);

        this._testParser = CachingTestParser.create(config);
        events.utils.passthroughEvent(this._testParser, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,
            RunnerEvents.AFTER_TESTS_READ
        ]);
    }

    public runTest(fullTitle: string, {browserId, browserVersion, file, sessionId, sessionCaps, sessionOpts}) {
        const tests = this._testParser.parse({file, browserId});
        const test = tests.find((t) => t.fullTitle() === fullTitle);
        const browserAgent = BrowserAgent.create(browserId, browserVersion, this._browserPool);
        const runner = TestRunner.create(test, this._config.forBrowser(browserId), browserAgent);

        return runner.run({sessionId, sessionCaps, sessionOpts});
    }
};
