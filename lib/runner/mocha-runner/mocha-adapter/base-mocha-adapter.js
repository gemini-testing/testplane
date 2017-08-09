'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const clearRequire = require('clear-require');
const _ = require('lodash');
const Mocha = require('mocha');
const q = require('q');
const RunnerEvents = require('../../../constants/runner-events');
const Skip = require('./skip');
const SkipBuilder = require('./skip/skip-builder');
const OnlyBuilder = require('./skip/only-builder');
const ProxyReporter = require('../proxy-reporter');

// Avoid mochajs warning about possible EventEmitter memory leak
// https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
// Reason: each mocha runner sets 'uncaughtException' listener
process.setMaxListeners(0);

module.exports = class BaseMochaAdapter extends EventEmitter {
    static create(browserAgent, config) {
        return new this(browserAgent, config);
    }

    constructor(browserAgent, config) {
        super();

        this._mochaOpts = config.mochaOpts;
        this._browserAgent = browserAgent;
        this._browser = null;

        global.hermione || (global.hermione = {});
        _.extend(global.hermione, {ctx: _.clone(config.ctx)});

        this._initMocha();
    }

    _initMocha() {
        this._mocha = new Mocha(this._mochaOpts);
        this._mocha.fullTrace();
        this.suite = this._mocha.suite;

        this.suite.setMaxListeners(0);
        this._addEventHandler('suite', (suite) => suite.setMaxListeners(0));

        this.tests = [];

        this._errMonitor = new EventEmitter();

        this._replaceTimeouts();
        this._injectBeforeHookErrorHandling();
        this._injectBeforeEachHookErrorHandling();
        this._injectBrowser();
        this._injectSkip();
        this._passthroughMochaEvents();
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

    disableHooksInSkippedSuites(suite) {
        suite = suite || this.suite;

        if (isSkipped(suite)) {
            disableSuiteHooks(suite);
        } else {
            suite.suites.forEach((s) => this.disableHooksInSkippedSuites(s));
        }
    }

    _replaceTimeouts() {
        throw new Error('Not implemented');
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
                    : q(baseFn).apply(this, arguments).catch((error) => onError(error, hook));
            };
        }));
    }

    _injectBrowser() {
        this.suite.beforeAll(() => this._requestBrowser());
        this.suite.afterAll(() => this._freeBrowser());
    }

    _injectSkip() {
        const skip = new Skip();
        const skipBuilder = new SkipBuilder(skip, this._browserAgent.browserId);
        const onlyBuilder = new OnlyBuilder(skipBuilder);

        _.extend(global.hermione, {skip: skipBuilder, only: onlyBuilder});

        this._addEventHandler(['suite', 'test'], (runnable) => skip.handleEntity(runnable));
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

    _getBrowser() {
        return this._browser || {id: this._browserAgent.browserId};
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
};

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
