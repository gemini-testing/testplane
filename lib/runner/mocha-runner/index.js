'use strict';

var Runner = require('../runner'),
    MochaAdapter = require('./mocha-adapter'),
    ProxyReporter = require('./proxy-reporter'),
    utils = require('q-promise-utils'),
    logger = require('../../utils').logger,

    _ = require('lodash'),
    inherit = require('inherit');

var MochaRunner = inherit(Runner, {
    __constructor: function(config, browserAgent) {
        this._sharedMochaOpts = config.mochaOpts;
        this._browserAgent = browserAgent;
        this._browser = null;
    },

    run: function(suitePaths, filterFn) {
        return _(suitePaths)
            .map(_.bind(this._createMocha, this, _, filterFn))
            .map(function(mocha) {
                return mocha.run();
            })
            .thru(utils.waitForResults)
            .value();
    },

    _createMocha: function(suiteFile, filterFn) {
        var mocha = new MochaAdapter(this._sharedMochaOpts);
        mocha.addFile(suiteFile);

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
        var browser = this._browserAgent.browserId;

        listenSuite_(suite);

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
        return new MochaRunner(config, browser);
    }
});

module.exports = MochaRunner;
