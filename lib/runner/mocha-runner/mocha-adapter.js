'use strict';

const ProxyReporter = require('./proxy-reporter');
const logger = require('../../utils').logger;
const Skip = require('./skip/');
const SkipBuilder = require('./skip/skip-builder');
const OnlyBuilder = require('./skip/only-builder');
const RunnerEvents = require('../../constants/runner-events');
const Mocha = require('mocha');
const path = require('path');
const clearRequire = require('clear-require');
const q = require('q');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;

// Avoid mochajs warning about possible EventEmitter memory leak
// https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
// Reason: each mocha runner sets 'uncaughtException' listener
process.setMaxListeners(0);

module.exports = class MochaAdapter extends EventEmitter {
    static prepare() {
        global.hermione = {};
    }

    static create(opts, browserAgent, ctx) {
        return new MochaAdapter(opts, browserAgent, ctx);
    }

    constructor(opts, browserAgent, ctx) {
        super();

        this._opts = opts;
        this._browserAgent = browserAgent;
        this._files = [];
        this._browser = null;

        this._initMocha();

        _.extend(global.hermione, {ctx});
    }

    _initMocha() {
        this._mocha = new Mocha(this._opts);
        this._mocha.fullTrace();
        this.suite = this._mocha.suite;

        this.tests = [];
        this._currentRunnable = null;

        this._injectBeforeHookErrorHandling();
        this._injectBeforeEachHookErrorHandling();
        this._injectBrowser();
        this._injectPretestFailVerification();
        this._injectRunnableSpy();
        this._injectSkip();
        this._passthroughMochaEvents();

        this._errMonitor = new EventEmitter();
    }

    applySkip(testSkipper) {
        testSkipper.applySkip(this.suite, this._browserAgent.browserId);

        return this;
    }

    loadFile(filename) {
        this._files.push(filename);
        this._currentTestIndex = 0;

        return this._loadFiles([filename]);
    }

    reloadFiles() {
        return this._loadFiles(this._files);
    }

    _loadFiles(files) {
        files.forEach((filename) => {
            clearRequire(path.resolve(filename));
            this._mocha.addFile(filename);
        });

        this._mocha.loadFiles();
        this._mocha.files = [];

        return this;
    }

    attachTestFilter(shouldRunTest) {
        this._addEventHandler('test', (test) => {
            if (shouldRunTest(test, this._currentTestIndex++)) {
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
        const defer = q.defer();

        this._errMonitor.on('err', (err) => defer.reject(err));
        this._mocha.run(() => defer.resolve());

        return defer.promise;
    }

    reinit() {
        this._initMocha();

        return this;
    }

    _injectSkip() {
        const skip = new Skip();
        const skipBuilder = new SkipBuilder(skip, this._browserAgent.browserId);
        const onlyBuilder = new OnlyBuilder(skipBuilder);

        _.extend(global.hermione, {skip: skipBuilder, only: onlyBuilder});

        this._addEventHandler(['suite', 'test'], (runnable) => skip.handleEntity(runnable));
    }

    _injectRunnableSpy() {
        const browserId = this._browserAgent.browserId;

        this._addEventHandler(
            ['beforeAll', 'beforeEach', 'test', 'afterEach', 'afterAll'],
            this._overrideRunnableFn((runnable, baseFn) => {
                const _this = this;
                return function() {
                    Object.getPrototypeOf(_this.suite.ctx.browser).executionContext = _.extend(runnable, {browserId});
                    // _this._currentRunnable = _.extend(runnable, {browserId});
                    return baseFn.apply(this, arguments);
                };
            })
        );
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

    _injectPretestFailVerification() {
        this._addEventHandler('test', this._overrideRunnableFn((test, baseFn) => {
            return function() {
                return test.fail
                    ? q.reject(test.fail)
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
        if (isSkipped(this.suite)) {
            return q();
        }

        return this._browserAgent.getBrowser()
            .then((browser) => {
                this._browser = browser;

                // Object.defineProperty(Object.getPrototypeOf(browser.publicAPI), 'executionContext', {
                //     get: () => this._currentRunnable
                // });

                this.suite.ctx.browser = browser.publicAPI;
            });
    }

    _freeBrowser() {
        return this._browser
            && this._browserAgent.freeBrowser(this._browser)
                .catch((e) => logger.warn('WARNING: can not release browser: ' + e));
    }

    _getBrowser() {
        return this._browser || {id: this._browserAgent.browserId};
    }
};

function isSkipped(suite) {
    return _.every(suite.suites, (s) => isSkipped(s))
        && _.every(suite.tests, 'pending');
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
