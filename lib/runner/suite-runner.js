'use strict';

var q = require('q'),
    Runner = require('./runner'),
    inherit = require('inherit'),
    ProxyReporter = require('../proxy-reporter'),
    Mocha = require('mocha'),
    logger = require('../utils').logger,

    path = require('path'),
    clearRequire = require('clear-require');

var SuiteRunner = inherit(Runner, {
    __constructor: function(config, browserAgent) {
        this.__base(config);
        this._browserAgent = browserAgent;
    },

    run: function(suiteFile) {
        var mocha = this._createMocha(suiteFile);

        return q.Promise(function(resolve) {
                clearRequire(path.resolve(suiteFile)); // clear require exactly before test file will be required by Mocha

                return mocha.run(resolve);
            });
    },

    _createMocha: function(suiteFile) {
        var mocha = new Mocha({
            timeout: this._config.timeout,
            slow: this._config.slow
        });

        mocha.addFile(suiteFile);
        mocha.fullTrace();

        var browser_;

        mocha.suite.beforeAll(function() {
            return this._browserAgent.getBrowser()
                .then(function(browser) {
                    browser_ = browser;
                    mocha.suite.ctx.browser = browser.publicAPI;
                });
        }.bind(this));

        mocha.suite.afterAll(function() {
            return browser_ && this._browserAgent.freeBrowser(browser_)
                .catch(function(e) {
                    logger.warn('WARNING: can not release browser: ' + e);
                });
        }.bind(this));

        this._listenMochaEvents(mocha, function() {
            return browser_;
        });

        return mocha;
    },

    _listenMochaEvents: function(mocha, getBrowser) {
        mocha.reporter(ProxyReporter, {
            browserId: this._browserAgent.browserId,
            getBrowser: getBrowser,
            emit: this.emit.bind(this)
        });
    }
}, {
    create: function(config, browser) {
        return new SuiteRunner(config, browser);
    }
});

module.exports = SuiteRunner;
