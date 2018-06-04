'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const clearRequire = require('clear-require');
const _ = require('lodash');
const Mocha = require('mocha');
const q = require('q');
const AssertViewResults = require('../../browser/commands/assert-view/assert-view-results');
const RunnerEvents = require('../../constants/runner-events');
const Skip = require('./skip');
const SkipBuilder = require('./skip/skip-builder');
const OnlyBuilder = require('./skip/only-builder');
const ProxyReporter = require('./proxy-reporter');
const logger = require('../../utils/logger');
const {getShortMD5} = require('../../utils/crypto');

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

        this._initMocha();

        _.extend(global.hermione, {ctx: _.clone(config.ctx)});
    }

    _initMocha() {
        this._browser = null;

        this._mocha = new Mocha(this._mochaOpts);
        this._mocha.fullTrace();

        this.suite = this._mocha.suite;
        this.suite.setMaxListeners(0);
        // setting of timeouts can lead to conflicts with timeouts which appear in subprocesses
        this.suite.enableTimeouts(false);
        this._addEventHandler('suite', (suite) => suite.setMaxListeners(0));

        this.tests = [];
        this._errMonitor = new EventEmitter();

        this._forbidSuiteHooks();
        this._removeTestHooks();
        this._injectSkip();
        this._extendSuiteApi();
        this._extendTestApi();
        this._passthroughMochaEvents();
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

    _extendSuiteApi() {
        let suiteCounter = 0;
        let filePath;

        // mocha does not set file for skipped suites
        // https://github.com/mochajs/mocha/blob/eb8bf8de205f3fdba072e58440e55256e701a7ba/lib/interfaces/bdd.js#L55
        this.suite.on('pre-require', (ctx, file) => {
            filePath = file;
        });

        this._addEventHandler('suite', (suite) => {
            const suiteIndex = suiteCounter++;
            suite.id = () => `${getShortMD5(filePath)}${suiteIndex}`;
        });
    }

    _extendTestApi() {
        this._addEventHandler('test', (test) => {
            test.id = () => getShortMD5(test.fullTitle());
        });
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
                let isBrokenSession = false;

                return workers.runTest(fullTitle, {browserId: browser.id, sessionId: browser.sessionId, file: test.file})
                    .then((data) => {
                        this._extendTestInfo(test, data);
                        browser.updateChanges(data.changes);
                    })
                    .catch((err) => {
                        this._extendTestInfo(test, err);
                        browser.updateChanges(err.changes);
                        isBrokenSession = this._patternsOnReject.some((p) => p.test(err.message));

                        return q.reject(err);
                    })
                    .finally(() => {
                        test.time = Date.now() - start;

                        return this._browserAgent.freeBrowser(this._browser, {force: isBrokenSession})
                            .catch((e) => logger.warn('WARNING: can not release browser: ' + e));
                    });
            });
    }

    _extendTestInfo(test, data) {
        const {meta, hermioneCtx = {}} = data;

        hermioneCtx.assertViewResults = AssertViewResults.fromRawObject(hermioneCtx.assertViewResults || []);

        _.extend(test, {
            sessionId: this._browser.sessionId,
            browserId: this._browser.id,
            meta,
            hermioneCtx,
            assertViewResults: hermioneCtx.assertViewResults.get()
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
