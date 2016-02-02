'use strict';

var q = require('q'),
    Runner = require('./runner'),
    inherit = require('inherit'),
    ProxyReporter = require('../proxy-reporter'),
    Mocha = require('mocha'),
    logger = require('../utils').logger,

    path = require('path'),
    clearRequire = require('clear-require');

// Avoid mochajs warning about possible EventEmitter memory leak
// https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
// Reason: each mocha runner sets 'uncaughtException' listener
process.setMaxListeners(0);

var SuiteRunner = inherit(Runner, {
    __constructor: function(config, browserAgent) {
        this.__base(config);
        this._browserAgent = browserAgent;
        this._browser = null;
    },

    run: function(suiteFile, filterFn) {
        var mocha = this._createMocha(suiteFile, filterFn);

        return q.Promise(function(resolve) {
                clearRequire(path.resolve(suiteFile)); // clear require exactly before test file will be required by Mocha

                return mocha.run(resolve);
            });
    },

    _createMocha: function(suiteFile, filterFn) {
        var mocha = new Mocha(this._config.mochaOpts);
        mocha.addFile(suiteFile);
        mocha.fullTrace();

        this._attachBrowser(mocha.suite);
        this._attachTestFilter(mocha.suite, filterFn);
        this._listenMochaEvents(mocha);

        return mocha;
    },

    _attachBrowser: function(suite) {
        var _this = this,
            savedEnableTimeouts = suite.enableTimeouts();

        suite.enableTimeouts(false);

        suite.beforeAll(function() {
            return _this._browserAgent.getBrowser()
                .then(function(browser) {
                    _this._browser = browser;
                    suite.ctx.browser = browser.publicAPI;
                });
        });

        suite.afterAll(function() {
            return _this._browser
                && _this._browserAgent.freeBrowser(_this._browser)
                    .catch(function(e) {
                        logger.warn('WARNING: can not release browser: ' + e);
                    });
        }.bind(this));

        suite.enableTimeouts(savedEnableTimeouts);
    },

    _attachTestFilter: function(suite, shouldRunTest) {
        var _this = this;

        listenSuite_(suite);

        function listenSuite_(suite) {
            suite.on('suite', listenSuite_);
            suite.on('test', filterTest_);
        }

        function filterTest_(test) {
            if (!shouldRunTest(test, _this._browserAgent.browserId)) {
                test.parent.tests.pop();
            }
        }
    },

    getBrowser: function() {
        return this._browser;
    },

    _listenMochaEvents: function(mocha, getBrowser) {
        mocha.reporter(ProxyReporter, {
            browserId: this._browserAgent.browserId,
            getBrowser: this.getBrowser.bind(this),
            emit: this.emit.bind(this)
        });
    }
}, {
    create: function(config, browser) {
        return new SuiteRunner(config, browser);
    }
});

module.exports = SuiteRunner;
