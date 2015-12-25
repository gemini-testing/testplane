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
        this._browserRunners = _.map(this._config.browsers, function(options, browserId) {
            return this._initBrowserRunner(browserId);
        }, this);
    },

    run: function() {
        this.emit(RunnerEvents.RUNNER_START);

        var _this = this;
        return _(this._browserRunners)
            .map(this._runBrowserRunner.bind(this))
            .thru(utils.waitForResults)
            .value()
            .fin(function() {
                _this.emit(RunnerEvents.RUNNER_END);
            });
    },

    _runBrowserRunner: function(runner) {
        var _this = this;
        return runner.run()
            .fail(function(e) {
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
