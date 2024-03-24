import _ from "lodash";
import { Runner } from "../runner.js";
import RegularTestRunner from "./regular-test-runner.js";
import HighPriorityBrowserAgent from "./high-priority-browser-agent.js";
import { MasterEvents } from "../../events/index.js";
import { passthroughEvent } from "../../events/utils.js";
import { NoRefImageError } from "../../browser/commands/assert-view/errors/no-ref-image-error.js";

export default class InsistantTestRunner extends Runner {
    constructor(test, config, browserAgent) {
        super();

        this._test = test;
        this._config = config;
        this._browserConfig = config.forBrowser(browserAgent.browserId);
        this._browserAgent = browserAgent;

        this._retriesPerformed = 0;
        this._cancelled = false;
    }

    async run(workers) {
        let retry = false;

        const browserAgent =
            this._retriesPerformed > 0 ? HighPriorityBrowserAgent.create(this._browserAgent) : this._browserAgent;

        const runner = RegularTestRunner.create(this._test, browserAgent).on(MasterEvents.TEST_FAIL, data => {
            if (this._shouldRetry(data)) {
                this.emit(MasterEvents.RETRY, _.extend(data, { retriesLeft: this._retriesLeft }));
                retry = true;
            } else {
                this.emit(MasterEvents.TEST_FAIL, data);
            }
        });

        passthroughEvent(runner, this, [MasterEvents.TEST_BEGIN, MasterEvents.TEST_PASS, MasterEvents.TEST_END]);

        await runner.run(workers);

        if (retry) {
            ++this._retriesPerformed;
            await this.run(workers);
        }
    }

    _shouldRetry(test) {
        if (this._cancelled) {
            return false;
        }

        if (typeof this._browserConfig.shouldRetry === "function") {
            return Boolean(
                this._browserConfig.shouldRetry({
                    ctx: test,
                    retriesLeft: this._retriesLeft,
                }),
            );
        }

        // TODO: replace with `instanceof AssertViewError` check
        // when errors will be correctly restored after transfer from workers
        if (test.err.name === "AssertViewError" && test.assertViewResults.some(e => e instanceof NoRefImageError)) {
            return false;
        }

        return this._retriesLeft > 0;
    }

    get _retriesLeft() {
        return this._browserConfig.retry - this._retriesPerformed;
    }

    cancel() {
        this._cancelled = true;
    }
}
