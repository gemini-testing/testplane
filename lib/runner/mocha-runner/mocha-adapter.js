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
        this._attachBrowser();
        this._skip = new Skip();
    },

    addFile: function(file) {
        clearRequire(path.resolve(file));
        this.suite.on('pre-require', () => {
            global.hermione = {
                skip: new SkipBuilder(this._skip, this._browserAgent.browserId)
            };
        });
        this.suite.on('post-require', () => delete global.hermione);
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
        const browserId = this._browserAgent.browserId;
        const applySkip = entity => this._skip.handleEntity(entity);

        listenSuite_(this.suite);
        return this;

        function listenSuite_(suite) {
            suite.on('suite', listenSuite_);
            suite.on('test', filterTest_);
            suite.on('suite', applySkip);
            suite.on('test', applySkip);
        }

        function filterTest_(test) {
            if (!shouldRunTest(test, browserId)) {
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
