'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const clearRequire = require('clear-require');
const _ = require('lodash');
const Mocha = require('mocha');
const q = require('q');
const RunnerEvents = require('../../constants/runner-events');
const Skip = require('./skip');
const SkipBuilder = require('./skip/skip-builder');
const OnlyBuilder = require('./skip/only-builder');
const ProxyReporter = require('./proxy-reporter');
const logger = require('../../utils').logger;

// Avoid mochajs warning about possible EventEmitter memory leak
// https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
// Reason: each mocha runner sets 'uncaughtException' listener
process.setMaxListeners(0);

module.exports = class MochaAdapter extends EventEmitter {
    static prepare() {
        global.hermione = global.hermione || {};
    }

    static create(browserAgent, config) {
        return new MochaAdapter(browserAgent, config);
    }

    constructor(browserAgent, config) {
        super();

        this._mochaOpts = config.mochaOpts;
        this._patternsOnReject = config.patternsOnReject.map((p) => new RegExp(p));
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
        // setting of timeouts can lead to conflicts with timeouts which appear in subprocesses
        this.suite.enableTimeouts(false);
        this._addEventHandler('suite', (suite) => suite.setMaxListeners(0));

        this.tests = [];
        this._brokenSession = false;
        this._errMonitor = new EventEmitter();

        this._attachSessionValidation();
        this._forbidSuiteHooks();
        this._removeTestHooks();
        this._injectSkip();
        this._passthroughMochaEvents();
    }

    _attachSessionValidation() {
        this.on(RunnerEvents.TEST_FAIL, (data) => {
            this._brokenSession = this._patternsOnReject.some((p) => p.test(data.err.message));
        });
    }

    _forbidSuiteHooks() {
        this._addEventHandler(['beforeAll', 'afterAll'], () => {
            throw new Error('"before" and "after" hooks are forbidden, use "beforeEach" and "afterEach" hooks instead');
        });
    }

    _removeTestHooks() {
        this._addEventHandler('beforeEach', (hook) => hook.parent._beforeEach.pop());
        this._addEventHandler('afterEach', (hook) => hook.parent._afterEach.pop());
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

    reinit() {
        this._initMocha();
    }

    applySkip(testSkipper) {
        testSkipper.applySkip(this.suite, this._browserAgent.browserId);

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

    loadFiles(files) {
        [].concat(files).forEach((filename) => {
            clearRequire(path.resolve(filename));
            this._mocha.addFile(filename);
        });

        this._mocha.loadFiles();
        this._mocha.files = [];

        return this;
    }

    run(workers) {
        this.suite.eachTest((test) => test.fn = () => this._runTest(test, workers));

        const defer = q.defer();

        this._errMonitor.on('err', (err) => defer.reject(err));
        this._mocha.run(() => defer.resolve());

        return defer.promise;
    }

    _runTest(test, workers) {
        return this._browserAgent.getBrowser()
            .then((browser) => this._browser = browser) // we need to save browser to use it in a proxy reporter
            .then(() => {
                const fullTitle = test.fullTitle();
                const browser = this._browser;
                const start = Date.now();

                return q.ninvoke(workers, 'runTest', fullTitle, {browserId: browser.id, sessionId: browser.sessionId})
                    .then(({meta, changes}) => {
                        this._extendTestInfo(test, meta);
                        browser.updateChanges(changes);
                    })
                    .catch((err) => {
                        this._extendTestInfo(test, err.meta);
                        browser.updateChanges(err.changes);

                        return q.reject(err);
                    })
                    .finally(() => {
                        test.time = Date.now() - start;

                        return this._browserAgent.freeBrowser(this._browser, {force: this._brokenSession})
                            .catch((e) => logger.warn('WARNING: can not release browser: ' + e));
                    });
            });
    }

    _extendTestInfo(test, meta) {
        _.extend(test, {
            sessionId: this._browser.sessionId,
            browserId: this._browser.id,
            meta
        });
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
