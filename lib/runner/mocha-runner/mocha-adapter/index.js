'use strict';

const q = require('q');
const BaseMochaAdapter = require('./base-mocha-adapter');
const RunnerEvents = require('../../../constants/runner-events');
const logger = require('../../../utils').logger;

module.exports = class MochaAdapter extends BaseMochaAdapter {
    constructor(browserAgent, config) {
        super(browserAgent, config);

        this._patternsOnReject = initPatternsOnReject(config.patternsOnReject);
    }

    _initMocha() {
        super._initMocha();

        this._brokenSession = false;

        this._removeHooks(); //must be executed after injecting of a browser
        this._attachSessionValidation();
    }

    run(workers) {
        this.suite.eachTest((test) => {
            test.fn = () => {
                if (test.fail) {
                    return q.reject(test.fail);
                }

                const defer = q.defer();
                const bro = this._browser;

                workers.runTest(test.fullTitle(), {browserId: bro.id, sessionId: bro.sessionId}, (err) => {
                    return err ? defer.reject(err) : defer.resolve();
                });

                return defer.promise;
            };
        });

        const defer = q.defer();

        this._errMonitor.on('err', (err) => defer.reject(err));
        this._mocha.run(() => defer.resolve());

        return defer.promise;
    }

    reinit() {
        this._initMocha();
    }

    _replaceTimeouts() {
        this.suite.enableTimeouts(false);
    }

    _removeHooks() {
        this._addEventHandler('beforeAll', (hook) => hook.parent._beforeAll.pop());
        this._addEventHandler('afterAll', (hook) => hook.parent._afterAll.pop());

        this._addEventHandler('beforeEach', (hook) => hook.parent._beforeEach.pop());
        this._addEventHandler('afterEach', (hook) => hook.parent._afterEach.pop());
    }

    _attachSessionValidation() {
        this.on(RunnerEvents.TEST_FAIL, (data) => {
            this._brokenSession = this._patternsOnReject.some((p) => p.test(data.err.message));
        });
    }

    _requestBrowser() {
        return this._browserAgent.getBrowser()
            .then((browser) => {
                this._browser = browser;

                this.suite.ctx.browser = browser.publicAPI;
            });
    }

    _freeBrowser() {
        return this._browser
            && this._browserAgent.freeBrowser(this._browser, {force: this._brokenSession})
                .catch((e) => logger.warn('WARNING: can not release browser: ' + e));
    }
};

function initPatternsOnReject(patternsOnReject) {
    return patternsOnReject.map((p) => new RegExp(p));
}
