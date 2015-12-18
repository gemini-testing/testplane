'use strict';

var q = require('q'),
    Runner = require('./runner'),
    inherit = require('inherit'),
    ProxyReporter = require('../proxy-reporter'),
    Mocha = require('mocha'),

    path = require('path'),
    clearRequire = require('clear-require');

var SuiteRunner = inherit(Runner, {
    __constructor: function(config, browser) {
        this.__base(config);
        this._browser = browser;
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

        mocha.suite.ctx.browser = this._browser.publicAPI;
        mocha.addFile(suiteFile);
        mocha.fullTrace();

        this._listenMochaEvents(mocha);

        return mocha;
    },

    _listenMochaEvents: function(mocha) {
        mocha.reporter(ProxyReporter, {
            browser: this._browser,
            emit: this.emit.bind(this)
        });
    }

}, {
    create: function(config, browser) {
        return new SuiteRunner(config, browser);
    }
});

module.exports = SuiteRunner;
