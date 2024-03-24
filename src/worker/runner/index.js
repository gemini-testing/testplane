import { AsyncEmitter } from "../../events/async-emitter/index.js";
import { passthroughEvent } from "../../events/utils.js";
import { WorkerEvents } from "../../events/index.js";
import BrowserPool from "./browser-pool.js";
import BrowserAgent from "./browser-agent.js";
import TestRunner from "./test-runner/index.js";
import CachingTestParser from "./caching-test-parser.js";

export default class Runner extends AsyncEmitter {
    static create(config) {
        return new Runner(config);
    }

    constructor(config) {
        super();

        this._config = config;
        this._browserPool = BrowserPool.create(this._config, this);

        this._testParser = CachingTestParser.create(config);
        passthroughEvent(this._testParser, this, [
            WorkerEvents.BEFORE_FILE_READ,
            WorkerEvents.AFTER_FILE_READ,
            WorkerEvents.AFTER_TESTS_READ,
        ]);
    }

    async runTest(fullTitle, { browserId, browserVersion, file, sessionId, sessionCaps, sessionOpts, state }) {
        const tests = await this._testParser.parse({ file, browserId });
        const test = tests.find(t => t.fullTitle() === fullTitle);
        const browserAgent = BrowserAgent.create({ id: browserId, version: browserVersion, pool: this._browserPool });
        const runner = TestRunner.create(test, this._config.forBrowser(browserId), browserAgent);

        return runner.run({ sessionId, sessionCaps, sessionOpts, state });
    }
}
