import { EventEmitter } from "events";
import _ from "lodash";
import { Runner } from "./runner";
import * as TestRunner from "./test-runner";
import { InterceptedEvent, MasterEvents } from "../events";
import SuiteMonitor from "./suite-monitor";
import BrowserAgent from "./browser-agent";
import PromiseGroup from "./promise-group";
import { Config } from "../config";
import { BrowserPool } from "../browser-pool";
import { Workers } from "./index";
import type { Test } from "../types";
import { TestCollection } from "../test-collection";

export interface BrowserRunner {
    on(event: InterceptedEvent, handler: (test: Test) => void): this;
}

export class BrowserRunner extends Runner {
    private _browserId: string;
    private config: Config;
    private browserPool: BrowserPool;
    private suiteMonitor: SuiteMonitor;
    private activeTestRunners: Set<TestRunner.TestRunner>;
    private workers: Workers;
    private running: PromiseGroup;

    constructor(browserId: string, config: Config, browserPool: BrowserPool, workers: Workers) {
        super();
        this._browserId = browserId;
        this.config = config;
        this.browserPool = browserPool;
        this.suiteMonitor = SuiteMonitor.create();
        this.passthroughEvents(this.suiteMonitor, [MasterEvents.SUITE_BEGIN, MasterEvents.SUITE_END]);
        this.activeTestRunners = new Set();
        this.workers = workers;
        this.running = new PromiseGroup();
    }

    get browserId(): string {
        return this._browserId;
    }

    async run(testCollection: TestCollection): Promise<void> {
        testCollection.eachTestByVersions(this._browserId, (test: Test) => {
            this.running.add(this._runTest(test));
        });

        await this.running.done();
    }

    addTestToRun(test: Test): boolean {
        if (this.running.isFulfilled()) {
            return false;
        }

        this.running.add(this._runTest(test));

        return true;
    }

    private async _runTest(test: Test): Promise<void> {
        const browserAgent = BrowserAgent.create({
            id: this._browserId,
            version: test.browserVersion,
            pool: this.browserPool,
        });
        const runner = TestRunner.create(test, this.config, browserAgent);

        runner.on(MasterEvents.TEST_BEGIN, (test: Test) => this.suiteMonitor.testBegin(test));

        this.passthroughEvents(runner, [
            MasterEvents.TEST_BEGIN,
            MasterEvents.TEST_END,
            MasterEvents.TEST_PASS,
            MasterEvents.TEST_FAIL,
            MasterEvents.TEST_PENDING,
            MasterEvents.RETRY,
        ]);

        runner.on(MasterEvents.TEST_END, (test: Test) => this.suiteMonitor.testEnd(test));
        runner.on(MasterEvents.RETRY, (test: Test) => this.suiteMonitor.testRetry(test));

        this.activeTestRunners.add(runner);

        await runner.run(this.workers);

        this.activeTestRunners.delete(runner);
    }

    cancel(): void {
        this.activeTestRunners.forEach(runner => runner.cancel());
    }

    private passthroughEvents(runner: EventEmitter, events: InterceptedEvent[]): void {
        events.forEach(event => {
            runner.on(event, (data: unknown) => this.emit(event, _.extend(data, { browserId: this._browserId })));
        });
    }
}
