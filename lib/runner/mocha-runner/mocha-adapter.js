'use strict';

const ProxyReporter = require('./proxy-reporter');
const logger = require('../../utils').logger;
const Skip = require('./skip/');
const SkipBuilder = require('./skip/skip-builder');
const Mocha = require('mocha');
const path = require('path');
const clearRequire = require('clear-require');
const q = require('q');
const _ = require('lodash');

// Avoid mochajs warning about possible EventEmitter memory leak
// https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
// Reason: each mocha runner sets 'uncaughtException' listener
process.setMaxListeners(0);

module.exports = class MochaAdapter {
    static create(opts, browserAgent) {
        return new MochaAdapter(opts, browserAgent);
    }

    constructor(opts, browserAgent) {
        this._mocha = new Mocha(opts);
        this._mocha.fullTrace();
        this.suite = this._mocha.suite;

        this._browserAgent = browserAgent;
        this._browser = null;

        this._injectBrowser();
        this._injectSkip();
    }

    addFile(file) {
        clearRequire(path.resolve(file));

        this._mocha.addFile(file);
        this._mocha.loadFiles();
        this._mocha.files = [];

        return this;
    }

    attachTestFilter(shouldRunTest) {
        const browserId = this._browserAgent.browserId;

        this._setEventHandler('test', (test) => shouldRunTest(test, browserId) || test.parent.tests.pop());

        return this;
    }

    attachEmitFn(emit) {
        const Reporter = _.partial(ProxyReporter, emit, () => this._getBrowser());
        this._mocha.reporter(Reporter);

        return this;
    }

    run() {
        return q.Promise(this._mocha.run.bind(this._mocha));
    }

    _injectSkip() {
        const skip = new Skip();

        this.suite.on('pre-require', () => {
            global.hermione = {
                skip: new SkipBuilder(skip, this._browserAgent.browserId)
            };
        });
        this.suite.on('post-require', () => delete global.hermione);

        this._setEventHandler(['suite', 'test'], (runnable) => skip.handleEntity(runnable));
    }

    // Set recursive handler for events triggered by mocha while parsing test file
    _setEventHandler(events, cb) {
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
            && this._browserAgent.freeBrowser(this._browser)
                .catch((e) => logger.warn('WARNING: can not release browser: ' + e));
    }

    _getBrowser() {
        return this._browser || {id: this._browserAgent.browserId};
    }
};
