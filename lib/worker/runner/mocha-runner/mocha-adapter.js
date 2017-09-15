'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const clearRequire = require('clear-require');
const _ = require('lodash');
const Mocha = require('mocha');
const q = require('q');
const RunnerEvents = require('../../../constants/runner-events');
const Skip = require('../../../runner/mocha-runner/skip');
const SkipBuilder = require('../../../runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('../../../runner/mocha-runner/skip/only-builder');
const ProxyReporter = require('../../../runner/mocha-runner/proxy-reporter');

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
        this._browserAgent = browserAgent;
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
        this._fail = null;
        this._errMonitor = new EventEmitter();

        this._replaceTimeouts();
        this._injectBrowser();
        this._injectSkip();
        this._injectExecutionContext();
        this._passthroughMochaEvents();
    }

    _replaceTimeouts() {
        this._addEventHandler(['beforeEach', 'test', 'afterEach'], (runnable) => {
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

    _injectBrowser() {
        this.suite.beforeEach(() => this._requestBrowser());
        this.suite.afterEach(() => this._freeBrowser());
    }

    _requestBrowser() {
        this._browser = this._browserAgent.getBrowser(this._sessionId);

        this.suite.ctx.browser = this._browser.publicAPI;
    }

    _freeBrowser() {
        this._browser && this._browserAgent.freeBrowser(this._browser);
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

        this._addEventHandler(['beforeEach', 'test', 'afterEach'], this._overrideRunnableFn((runnable, baseFn) => {
            const _this = this;
            return function() {
                const browser = _this.suite.ctx.browser;
                if (browser) {
                    Object.getPrototypeOf(browser).executionContext = _.extend(runnable, {browserId});
                }
                return baseFn.apply(this, arguments);
            };
        }));
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

    reinit() {
        this._initMocha();
    }

    isFailed() {
        return Boolean(this._fail);
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

    loadFiles(files) {
        [].concat(files).forEach((filename) => {
            clearRequire(path.resolve(filename));
            this._mocha.addFile(filename);
        });

        this._mocha.loadFiles();
        this._mocha.files = [];

        return this;
    }

    runInSession(sessionId) {
        this._sessionId = sessionId;

        const defer = q.defer();

        this.on(RunnerEvents.ERROR, (err) => this._fail = err);
        this.on(RunnerEvents.TEST_FAIL, (data) => this._fail = data.err);
        this._errMonitor.on('err', (err) => defer.reject(err));

        this._mocha.run(() => {
            const meta = this._browser && this._browser.meta;

            return this._fail ? defer.reject(_.extend(this._fail, {meta})) : defer.resolve({meta});
        });

        return defer.promise;
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
