'use strict';

const _ = require('lodash');
const q = require('q');
const BaseMochaAdapter = require('../../../runner/mocha-runner/mocha-adapter/base-mocha-adapter');
const RunnerEvents = require('../../../constants/runner-events');

module.exports = class MochaAdapter extends BaseMochaAdapter {
    _initMocha() {
        super._initMocha();

        this._injectPretestFailVerification();
        this._injectExecutionContext();
    }

    runInSession(sessionId) {
        this._sessionId = sessionId;

        const defer = q.defer();

        let err;

        this.on(RunnerEvents.TEST_FAIL, (data) => err = data.err);
        this._errMonitor.on('err', (err) => defer.reject(err));
        this._mocha.run(() => err ? defer.reject(err) : defer.resolve());

        return defer.promise;
    }

    _replaceTimeouts() {
        this._addEventHandler(['beforeAll', 'beforeEach', 'test', 'afterEach', 'afterAll'], (runnable) => {
            if (!runnable.enableTimeouts()) {
                return;
            }

            const baseFn = runnable.fn;
            const timeout = runnable.timeout() || Infinity;

            runnable.enableTimeouts(false);
            runnable.fn = function() {
                return q(baseFn).apply(this, arguments).timeout(timeout);
            };
        });
    }

    _injectPretestFailVerification() {
        this._addEventHandler('test', this._overrideRunnableFn((test, baseFn) => {
            return function() {
                return test.fail
                    ? q.reject(test.fail)
                    : baseFn.apply(this, arguments);
            };
        }));
    }

    _injectExecutionContext() {
        const browserId = this._browserAgent.browserId;

        this._addEventHandler(
            ['beforeAll', 'beforeEach', 'test', 'afterEach', 'afterAll'],
            this._overrideRunnableFn((runnable, baseFn) => {
                const _this = this;
                return function() {
                    const browser = _this.suite.ctx.browser;
                    if (browser) {
                        Object.getPrototypeOf(browser).executionContext = _.extend(runnable, {browserId});
                    }
                    return baseFn.apply(this, arguments);
                };
            })
        );
    }

    _requestBrowser() {
        this._browser = this._browserAgent.getBrowser(this._sessionId);

        this.suite.ctx.browser = this._browser.publicAPI;
    }

    _freeBrowser() {
        this._browserAgent.freeBrowser(this._browser);
    }
};
