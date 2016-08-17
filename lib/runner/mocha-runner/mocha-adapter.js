'use strict';

var ProxyReporter = require('./proxy-reporter'),
    logger = require('../../utils').logger,
    Skip = require('./skip/'),
    SkipBuilder = require('./skip/skip-builder'),
    inherit = require('inherit'),
    Mocha = require('mocha'),
    path = require('path'),
    clearRequire = require('clear-require'),
    q = require('q'),
    _ = require('lodash');

// Avoid mochajs warning about possible EventEmitter memory leak
// https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
// Reason: each mocha runner sets 'uncaughtException' listener
process.setMaxListeners(0);

module.exports = inherit({
    __constructor: function(opts, browserAgent) {
        this._mocha = new Mocha(opts);
        this._mocha.fullTrace();
        this.suite = this._mocha.suite;

        this._browserAgent = browserAgent;
        this._browser = null;

        this._injectBrowser();
        this._injectSkip();
    },

    addFile: function(file) {
        clearRequire(path.resolve(file));

        this._mocha.addFile(file);
        this._mocha.loadFiles();
        this._mocha.files = [];

        return this;
    },

    attachTestFilter: function(shouldRunTest) {
        const browserId = this._browserAgent.browserId;

        this._setEventHandler('test', (test) => {
            if (!shouldRunTest(test, browserId)) {
                test.parent.tests.pop();
            }
        });

        return this;
    },

    attachEmitFn: function(emit) {
        var Reporter = _.partial(ProxyReporter, emit, this._getBrowser.bind(this));
        this._mocha.reporter(Reporter);

        return this;
    },

    run: function() {
        return q.Promise(this._mocha.run.bind(this._mocha));
    },

    _injectSkip: function() {
        const skip = new Skip();

        this.suite.on('pre-require', () => {
            global.hermione = {
                skip: new SkipBuilder(skip, this._browserAgent.browserId)
            };
        });
        this.suite.on('post-require', () => delete global.hermione);

        this._setEventHandler(['suite', 'test'], (runnable) => skip.handleEntity(runnable));
    },

    // Set recursive handler for events triggered by mocha while parsing test files
    _setEventHandler: function(events, cb) {
        events = [].concat(events);

        const listenSuite = (suite) => {
            suite.on('suite', listenSuite);
            events.forEach((e) => suite.on(e, cb));
        };

        listenSuite(this.suite);
    },

    _injectBrowser: function() {
        var savedEnableTimeouts = this.suite.enableTimeouts();

        this.suite.enableTimeouts(false);

        this.suite.beforeAll(this._requestBrowser.bind(this));
        this.suite.afterAll(this._freeBrowser.bind(this));

        this.suite.enableTimeouts(savedEnableTimeouts);
    },

    _requestBrowser: function() {
        return this._browserAgent.getBrowser()
            .then(function(browser) {
                this._browser = browser;
                this.suite.ctx.browser = browser.publicAPI;
            }.bind(this));
    },

    _freeBrowser: function() {
        return this._browser
            && this._browserAgent.freeBrowser(this._browser)
                .catch(function(e) {
                    logger.warn('WARNING: can not release browser: ' + e);
                });
    },

    _getBrowser: function() {
        return this._browser || {id: this._browserAgent.browserId};
    }
});
