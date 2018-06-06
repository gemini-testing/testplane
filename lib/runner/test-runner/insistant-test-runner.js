'use strict';

const _ = require('lodash');

const TestRunner = require('./test-runner');
const RegularTestRunner = require('./regular-test-runner');
const Events = require('../../constants/runner-events');
const {passthroughEvent} = require('gemini-core').events.utils;
const NoRefImageError = require('../../browser/commands/assert-view/errors/no-ref-image-error');

module.exports = class InsistantTestRunner extends TestRunner {
    constructor(test, config, browserAgent) {
        super();

        this._test = test;
        this._config = config;
        this._browserConfig = config.forBrowser(browserAgent.browserId);
        this._browserAgent = browserAgent;

        this._retriesPerformed = 0;
    }

    async run(workers) {
        let retry = false;

        const runner = RegularTestRunner.create(this._test, this._config, this._browserAgent)
            .on(Events.TEST_FAIL, (data) => {
                if (this._shouldRetry(data)) {
                    this.emit(Events.RETRY, _.extend(data, {retriesLeft: this._retriesLeft}));
                    retry = true;
                } else {
                    this.emit(Events.TEST_FAIL, data);
                }
            });

        passthroughEvent(runner, this, [
            Events.TEST_BEGIN,
            Events.TEST_PASS,
            Events.TEST_END
        ]);

        await runner.run(workers);

        if (retry) {
            ++this._retriesPerformed;
            await this.run(workers);
        }
    }

    _shouldRetry(test) {
        if (typeof this._browserConfig.shouldRetry === 'function') {
            return Boolean(this._browserConfig.shouldRetry({
                ctx: test,
                retriesLeft: this._retriesLeft
            }));
        }

        // TODO: replace with `instanceof AssertViewError` check
        // when errors will be correctly restored after transfer from workers
        if (test.err.name === 'AssertViewError' && test.assertViewResults.some((e) => e instanceof NoRefImageError)) {
            return false;
        }

        return this._retriesLeft > 0;
    }

    get _retriesLeft() {
        return this._browserConfig.retry - this._retriesPerformed;
    }
};
