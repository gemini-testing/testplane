'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const clearRequire = require('clear-require');
const _ = require('lodash');
const Mocha = require('mocha');
const q = require('q');
const Promise = require('bluebird');
const RunnerEvents = require('../constants/runner-events');
const Skip = require('../../runner/mocha-runner/skip');
const SkipBuilder = require('../../runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('../../runner/mocha-runner/skip/only-builder');
const ProxyReporter = require('./proxy-reporter');
const {getShortMD5} = require('../../../lib/utils/crypto');
const logger = require('../../../lib/utils/logger');

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

        this._config = config;
        this._browserAgent = browserAgent;

        _.extend(global.hermione, {ctx: _.clone(config.ctx)});

        this._browser = null;
        this._screenshotTaken = false;

        this._mocha = new Mocha(config.mochaOpts);
        this._mocha.fullTrace();

        this.suite = this._mocha.suite;
        this.suite.setMaxListeners(0);
        this._addEventHandler('suite', (suite) => suite.setMaxListeners(0));

        this.tests = [];
        this._ctx = {};
        this._errMonitor = new EventEmitter();

        this._replaceTimeouts();
        this._injectScreenshotOnReject();
        this._injectSkip();
        this._linkContexts();
        this._extendTestApi();
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
                return Promise.method(baseFn).apply(this, arguments).timeout(timeout);
            };
        });
    }

    _injectScreenshotOnReject() {
        if (!this._config.screenshotOnReject) {
            return;
        }

        this._addEventHandler(['beforeEach', 'test', 'afterEach'], this._overrideRunnableFn((runnable, baseFn) => {
            const extendWithScreenshot = this._extendWithScreenshot.bind(this);
            return function() {
                return Promise.method(baseFn).apply(this, arguments)
                    .catch(async (err) => Promise.reject(await extendWithScreenshot(err)));
            };
        }));
    }

    async _extendWithScreenshot(err) {
        if (this._screenshotTaken || err.screenshot) {
            return err;
        }

        this._screenshotTaken = true;
        this._browser.setHttpTimeout(this._config.screenshotOnRejectTimeout);

        try {
            const {value: screenshot} = await this._browser.publicAPI.screenshot();
            err = Object.assign(err, {screenshot});
        } catch (e) {
            logger.warn(`WARN: Failed to take screenshot on reject: ${e}`);
        }

        this._browser.restoreHttpTimeout();

        return err;
    }

    _injectSkip() {
        const skip = new Skip();
        const skipBuilder = new SkipBuilder(skip, this._browserAgent.browserId);
        const onlyBuilder = new OnlyBuilder(skipBuilder);

        _.extend(global.hermione, {skip: skipBuilder, only: onlyBuilder});

        this._addEventHandler(['suite', 'test'], (runnable) => skip.handleEntity(runnable));
    }

    _extendTestApi() {
        this._addEventHandler('test', (test) => {
            test.id = () => getShortMD5(test.fullTitle());
        });
    }

    _linkContexts() {
        const browserId = this._browserAgent.browserId;

        this._addEventHandler(['beforeEach', 'test', 'afterEach'], this._overrideRunnableFn((runnable, baseFn) => {
            const _this = this;
            runnable.hermioneCtx = this._ctx;

            return function() {
                const browser = _this.suite.ctx.browser;
                const setExecutionContext = browser
                    ? (context) => Object.getPrototypeOf(browser).executionContext = context
                    : () => {};

                setExecutionContext(_.extend(runnable, {browserId}));
                return Promise.method(baseFn).apply(this, arguments)
                    .finally(() => setExecutionContext(null));
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
        return this._requestBrowser(sessionId)
            .then(() => this._run())
            .finally(() => this._freeBrowser());
    }

    _requestBrowser(sessionId) {
        return this._browserAgent.getBrowser(sessionId)
            .then((browser) => {
                this._browser = browser;

                this.suite.ctx.browser = this._browser.publicAPI;
            });
    }

    _freeBrowser() {
        this._browser && this._browserAgent.freeBrowser(this._browser);
    }

    _run() {
        const defer = q.defer();

        let fail = null;

        this.on(RunnerEvents.ERROR, (err) => fail = fail || err);
        this.on(RunnerEvents.TEST_FAIL, (data) => fail = data.err);
        this._errMonitor.on('err', (err) => defer.reject(err));

        this._mocha.run(() => {
            this._ctx.assertViewResults = this._ctx.assertViewResults ? this._ctx.assertViewResults.toRawObject() : [];

            const browser = this._browser || {};
            const {meta, changes} = browser;
            const data = {hermioneCtx: this._ctx, meta, changes};

            return fail ? defer.reject(_.extend(fail, data)) : defer.resolve(data);
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
