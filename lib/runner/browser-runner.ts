import _ from 'lodash';

import Runner from './runner';
import * as TestRunner from './test-runner';
import Events from '../constants/runner-events';
import SuiteMonitor from './suite-monitor';
import BrowserAgent from './browser-agent';
import PromiseGroup from './promise-group';

import type { BrowserPool } from 'gemini-core';
import type Config from '../config';
import type TestCollection from '../test-collection';

export default class BrowserRunner extends Runner {
    private _browserId: string;
    private _config: Config;
    private _browserPool: typeof BrowserPool;
    private _suiteMonitor: SuiteMonitor;
    private _activeTestRunners: Set<Runner>;
    private _workers: unknown;
    private _running: PromiseGroup;

    constructor(browserId: string, config: Config, browserPool: typeof BrowserPool, workers) {
        super();

        this._browserId = browserId;
        this._config = config;
        this._browserPool = browserPool;

        this._suiteMonitor = SuiteMonitor.create();
        this._passthroughEvents(this._suiteMonitor, [
            Events.SUITE_BEGIN,
            Events.SUITE_END
        ]);

        this._activeTestRunners = new Set();
        this._workers = workers;
        this._running = new PromiseGroup();
    }

    get browserId(): string {
        return this._browserId;
    }

    public async run(testCollection: TestCollection) {
        testCollection.eachTestByVersions(this._browserId, (test) => {
            this._running.add(this._runTest(test));
        });

        await this._running.done();
    }

    addTestToRun(test) {
        if (this._running.isFulfilled()) {
            return false;
        }

        this._running.add(this._runTest(test));

        return true;
    }

    async _runTest(test) {
        const browserAgent = BrowserAgent.create(this._browserId, test.browserVersion, this._browserPool);
        const runner = TestRunner.create(test, this._config, browserAgent);

        runner.on(Events.TEST_BEGIN, (test) => this._suiteMonitor.testBegin(test));

        this._passthroughEvents(runner, [
            Events.TEST_BEGIN,
            Events.TEST_END,
            Events.TEST_PASS,
            Events.TEST_FAIL,
            Events.TEST_PENDING,
            Events.RETRY
        ]);

        runner.on(Events.TEST_END, (test) => this._suiteMonitor.testEnd(test));
        runner.on(Events.RETRY, (test) => this._suiteMonitor.testRetry(test));

        this._activeTestRunners.add(runner);

        await runner.run(this._workers);

        this._activeTestRunners.delete(runner);
    }

    cancel() {
        this._activeTestRunners.forEach((runner) => runner.cancel());
    }

    _passthroughEvents(runner, events) {
        events.forEach((event) => {
            runner.on(event, (data) => this.emit(event, _.extend(data, {browserId: this._browserId})));
        });
    }
};
