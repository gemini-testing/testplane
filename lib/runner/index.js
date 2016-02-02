'use strict';

var inherit = require('inherit'),
    _ = require('lodash'),
    utils = require('q-promise-utils'),
    Runner = require('./runner'),
    BrowserRunner = require('./browser-runner'),
    BrowserPool = require('../browser-pool'),
    RetryManager = require('../retry-manager'),

    RunnerEvents = require('../constants/runner-events');

var MainRunner = inherit(Runner, {
    __constructor: function(config) {
        this.__base(config);

        this._retryMgr = new RetryManager(this._config);
        this.passthroughEvent(this._retryMgr, [
            RunnerEvents.TEST_FAIL,
            RunnerEvents.ERROR,
            RunnerEvents.RETRY
        ]);

        this._pool = new BrowserPool(this._config);
    },

    run: function(suites, browsers) {
        this.emit(RunnerEvents.RUNNER_START);

        var anyTest = _.identity.bind(null, true);
        return this._runTestSession(suites, browsers, anyTest)
            .finally(function() {
                this.emit(RunnerEvents.RUNNER_END);
            }.bind(this));
    },

    _runTestSession: function(suites, browsers, filterFn) {
        var _this = this;

        return _(browsers)
            .map(function(browserId) {
                return _this._initBrowserRunner(browserId)
                    .run(suites, filterFn);
            })
            .thru(utils.waitForResults)
            .value()
            .then(function() {
                return _this._retryMgr.retry(_this._runTestSession.bind(_this));
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
            RunnerEvents.TEST_PENDING,

            RunnerEvents.INFO,
            RunnerEvents.WARNING
        ]);

        browserRunner.on(RunnerEvents.TEST_FAIL, this._retryMgr.handleTestFail.bind(this._retryMgr));
        browserRunner.on(RunnerEvents.ERROR, this._retryMgr.handleError.bind(this._retryMgr));

        return browserRunner;
    }
}, {
    create: function(config) {
        return new MainRunner(config);
    }
});

module.exports = MainRunner;
