'use strict';

const path = require('path');
const _ = require('lodash');
const Promise = require('bluebird');
const EventEmitter = require('events').EventEmitter;
const Mocha = require('mocha');
const clearRequire = require('clear-require');

const ProxyReporter = require('./proxy-reporter');
const logger = require('../../utils').logger;
const Skip = require('./skip');
const SkipBuilder = require('./skip/skip-builder');
const OnlyBuilder = require('./skip/only-builder');
const RunnerEvents = require('../../constants/runner-events');

// Avoid mochajs warning about possible EventEmitter memory leak
// https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
// Reason: each mocha runner sets 'uncaughtException' listener
process.setMaxListeners(0);

module.exports = class MochaAdapter extends EventEmitter {
    static prepare() {
        global.hermione = {};
    }

    static create(browserAgent, config) {
        return new MochaAdapter(browserAgent, config);
    }

    constructor(browserAgent, config) {
        super();

        this._mochaOpts = config.mochaOpts;
        this._patternsOnReject = initPatternsOnReject(config.patternsOnReject);
        this._browserAgent = browserAgent;
        this._brokenSession = false;
        this._browser = null;

        this._initMocha();

        _.extend(global.hermione, {ctx: _.clone(config.ctx)});
    }

    _initMocha() {
        this._mocha = new Mocha(this._mochaOpts);
        this._mocha.fullTrace();
        this.suite = this._mocha.suite;

        this.suite.setMaxListeners(0);
        this._addEventHandler('suite', (suite) => suite.setMaxListeners(0));

        this.tests = [];

        this._replaceTimeouts();
        this._injectBeforeHookErrorHandling();
        this._injectBeforeEachHookErrorHandling();
        this._injectBrowser();
        this._injectPretestFailVerification();
        this._injectExecutionContext();
        this._injectSkip();
        this._attachSessionValidation();
        this._passthroughMochaEvents();

        this._errMonitor = new EventEmitter();
    }

    _attachSessionValidation() {
        this.on(RunnerEvents.TEST_FAIL, (data) => {
            this._brokenSession = this._patternsOnReject.some((p) => p.test(data.err.message));
        });
    }

    applySkip(testSkipper) {
        testSkipper.applySkip(this.suite, this._browserAgent.browserId);

        return this;
    }

    loadFiles(files) {
        [].concat(files).forEach((filename) => {
            clearRequire(path.resolve(filename));
            this._mocha.addFile(filename);
        });

        this._mocha.loadFiles();
        this._mocha.files = [];

        return this;
    }

    attachTestFilter(shouldRunTest) {
        this._addEventHandler('test', (test) => {
            if (shouldRunTest(test)) {
                this.tests.push(test);
                return;
            }

            test.parent.tests.pop();
        });

        return this;
    }

    _passthroughMochaEvents() {
        const _this = this;
        function monitoredEmit() {
            try {
                _this.emit.apply(_this, arguments);
            } catch (e) {
                _this._errMonitor.emit('err', e);
                throw e;
            }
        }
        this._attachProxyReporter(monitoredEmit);
        this._passthroughFileEvents(monitoredEmit);
    }

    _attachProxyReporter(emit) {
        const Reporter = _.partial(ProxyReporter, emit, () => this._getBrowser());
        this._mocha.reporter(Reporter);
    }

    _passthroughFileEvents(emit) {
        const emit_ = (event, file) => emit(event, {
            file,
            hermione: global.hermione,
            browser: this._browserAgent.browserId,
            suite: this.suite
        });

        this.suite.on('pre-require', (ctx, file) => emit_(RunnerEvents.BEFORE_FILE_READ, file));
        this.suite.on('post-require', (ctx, file) => emit_(RunnerEvents.AFTER_FILE_READ, file));

        return this;
    }

    run() {
        return new Promise((resolve, reject) => {
            this._errMonitor.on('err', (err) => reject(err));
            this._mocha.run((failed) => resolve({failed}));
        });
    }

    reinit() {
        this._initMocha();
    }

    _injectSkip() {
        const skip = new Skip();
        const skipBuilder = new SkipBuilder(skip, this._browserAgent.browserId);
        const onlyBuilder = new OnlyBuilder(skipBuilder);

        _.extend(global.hermione, {skip: skipBuilder, only: onlyBuilder});

        this._addEventHandler(['suite', 'test'], (runnable) => skip.handleEntity(runnable));
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

    _replaceTimeouts() {
        this._addEventHandler(['beforeAll', 'beforeEach', 'test', 'afterEach', 'afterAll'], (runnable) => {
            if (!runnable.enableTimeouts()) {
                return;
            }

            const baseFn = runnable.fn;
            const timeout = runnable.timeout() || Infinity;

            runnable.enableTimeouts(false);
            runnable.fn = function() {
                return Promise.try(() => baseFn.apply(this, arguments)).timeout(timeout);
            };
        });
    }

    _injectBeforeHookErrorHandling() {
        this._injectHookErrorHandling('beforeAll', (error, hook) => markSuiteAsFailed(hook.parent, error));
    }

    _injectBeforeEachHookErrorHandling() {
        this._injectHookErrorHandling('beforeEach', (error, hook) => markTestAsFailed(hook.ctx.currentTest, error));
    }

    _injectHookErrorHandling(event, onError) {
        this._addEventHandler(event, this._overrideRunnableFn((hook, baseFn) => {
            return function() {
                const previousBeforeAllHookFail = hook.parent.fail;
                const previousBeforeEachHookFail = _.get(hook, 'ctx.currentTest.fail');
                const previousFail = previousBeforeAllHookFail || previousBeforeEachHookFail;

                return previousFail
                    ? onError(previousFail, hook)
                    : Promise.try(() => baseFn.apply(this, arguments)).catch((error) => onError(error, hook));
            };
        }));
    }

    _injectPretestFailVerification() {
        this._addEventHandler('test', this._overrideRunnableFn((test, baseFn) => {
            return function() {
                return test.fail
                    ? Promise.reject(test.fail)
                    : baseFn.apply(this, arguments);
            };
        }));
    }

    _overrideRunnableFn(overrideFn) {
        return (runnable) => {
            const baseFn = runnable.fn;
            if (baseFn) {
                runnable.fn = overrideFn(runnable, baseFn);
            }
        };
    }

    // Set recursive handler for events triggered by mocha while parsing test file
    _addEventHandler(events, cb) {
        events = [].concat(events);

        const listenSuite = (suite) => {
            suite.on('suite', listenSuite);
            events.forEach((e) => suite.on(e, cb));
        };

        listenSuite(this.suite);
    }

    _injectBrowser() {
        const savedEnableTimeouts = this.suite.enableTimeouts();

        this.suite.enableTimeouts(false);

        this.suite.beforeAll(() => this._requestBrowser());
        this.suite.afterAll(() => this._freeBrowser());

        this.suite.enableTimeouts(savedEnableTimeouts);
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

    _getBrowser() {
        return this._browser || {id: this._browserAgent.browserId};
    }

    disableHooksInSkippedSuites(suite) {
        suite = suite || this.suite;

        if (isSkipped(suite)) {
            disableSuiteHooks(suite);
        } else {
            suite.suites.forEach((s) => this.disableHooksInSkippedSuites(s));
        }
    }
};

function initPatternsOnReject(patternsOnReject) {
    return patternsOnReject.map((p) => new RegExp(p));
}

function isSkipped(suite) {
    return _.every(suite.suites, (s) => isSkipped(s))
        && _.every(suite.tests, 'pending');
}

function disableSuiteHooks(suite) {
    suite._beforeAll = [];
    suite._afterAll = [];
    suite.suites.forEach((s) => disableSuiteHooks(s));
}

function markSuiteAsFailed(suite, error) {
    suite.fail = error;
    eachSuiteAndTest(suite, (runnable) => runnable.fail = error);
}

function eachSuiteAndTest(runnable, cb) {
    runnable.tests.forEach((test) => cb(test));
    runnable.suites.forEach((suite) => {
        cb(suite);
        eachSuiteAndTest(suite, cb);
    });
}

function markTestAsFailed(test, error) {
    test.fail = error;
}
