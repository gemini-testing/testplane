'use strict';

var inherit = require('inherit'),
    _ = require('lodash'),
    utils = require('q-promise-utils'),
    Runner = require('./runner'),
    SuiteRunner = require('./suite-runner'),
    RunnerEvents = require('../constants/runner-events');

var BrowserRunner = inherit(Runner, {
    __constructor: function(config, browserId, browserPool) {
        this.__base(config);
        this._browserId = browserId;
        this._pool = browserPool;
    },

    run: function() {
        var suitePaths = this._config.tests,
            _this = this;

        this.emit(RunnerEvents.BROWSER_START, this._browserId);

        return _(suitePaths)
            .map(function(suitePath) {
                return _this._runSuite(suitePath);
            })
            .thru(utils.waitForResults)
            .value()
            .fin(function() {
                _this.emit(RunnerEvents.BROWSER_END, _this._browserId);
            });
    },

    _runSuite: function(suitePath) {
        var _this = this;
        return this._pool.getBrowser(this._browserId)
            .then(function(browser) {
                return _this._executeSuite(suitePath, browser)
                    .fin(function() {
                        return _this._pool.freeBrowser(browser);
                    });
            });
    },

    _executeSuite: function(suitePath, browser) {
        var suiteRunner = SuiteRunner.create(this._config, browser);

        this.passthroughEvent(suiteRunner, [
            RunnerEvents.SUITE_BEGIN,
            RunnerEvents.SUITE_END,

            RunnerEvents.TEST_BEGIN,
            RunnerEvents.TEST_END,

            RunnerEvents.TEST_PASS,
            RunnerEvents.TEST_FAIL,
            RunnerEvents.TEST_PENDING,

            RunnerEvents.INFO,
            RunnerEvents.WARNING,
            RunnerEvents.ERROR
        ]);

        return suiteRunner.run(suitePath);
    }

}, {
    create: function(config, _browserId, browserPool) {
        return new BrowserRunner(config, _browserId, browserPool);
    }
});

module.exports = BrowserRunner;
