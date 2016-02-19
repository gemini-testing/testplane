'use strict';

var ProxyReporter = require('./proxy-reporter'),
    logger = require('../../utils').logger,
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
        this._attachBrowser();
    },

    addFile: function(file) {
        clearRequire(path.resolve(file));
        this._mocha.addFile(file);
        this._mocha.loadFiles();
        this._mocha.files = [];

        return this;
    },

    _attachBrowser: function() {
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

    attachTestFilter: function(shouldRunTest) {
        var browser = this._browserAgent.browserId;

        listenSuite_(this.suite);
        return this;

        function listenSuite_(suite) {
            suite.on('suite', listenSuite_);
            suite.on('test', filterTest_);
        }

        function filterTest_(test) {
            if (!shouldRunTest(test, browser)) {
                test.parent.tests.pop();
            }
        }
    },

    attachEmitFn: function(emit) {
        var Reporter = _.partial(ProxyReporter, emit, this._getBrowser.bind(this));
        this._mocha.reporter(Reporter);

        return this;
    },

    _getBrowser: function() {
        return this._browser || {id: this._browserAgent.browserId};
    },

    run: function() {
        return q.Promise(this._mocha.run.bind(this._mocha));
    }
});
