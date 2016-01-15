'use strict';

var inherit = require('inherit'),
    q = require('q'),
    _ = require('lodash'),
    utils = require('q-promise-utils'),
    Runner = require('./runner'),
    BrowserRunner = require('./browser-runner'),
    BrowserPool = require('../browser-pool'),

    RunnerEvents = require('../constants/runner-events');

var MainRunner = inherit(Runner, {
    __constructor: function(config) {
        this.__base(config);
        this._pool = new BrowserPool(this._config);
    },

    run: function(suites, browsers) {
        this.emit(RunnerEvents.RUNNER_START);

        var _this = this,
            browserRunners = _.map(browsers, function(browserId) {
                return _this._initBrowserRunner(browserId);
            });

        return _(browserRunners)
            .map(function(runner) {
                return _this._runBrowserRunner(runner, suites);
            })
            .thru(utils.waitForResults)
            .value()
            .finally(function() {
                _this.emit(RunnerEvents.RUNNER_END);
            });
    },

    _runBrowserRunner: function(runner, suites) {
        var _this = this;
        return runner.run(suites)
            .catch(function(e) {
                _this.emit(RunnerEvents.ERROR, e);
                return q.reject(e);
            });
    },

    _initBrowserRunner: function(browserId) {
        var browserRunner = BrowserRunner.create(this._config, browserId, this._pool);

        this.passthroughEvent(browserRunner, [
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

        return browserRunner;
    }
}, {
    create: function(config) {
        return new MainRunner(config);
    }
});

module.exports = MainRunner;
