'use strict';

var inherit = require('inherit'),
    _ = require('lodash'),
    utils = require('q-promise-utils'),
    Runner = require('./runner'),
    SuiteRunner = require('./suite-runner'),
    BrowserAgent = require('../browser-agent'),
    RunnerEvents = require('../constants/runner-events');

var BrowserRunner = inherit(Runner, {
    __constructor: function(config, browserId, browserPool) {
        this.__base(config);
        this._browserId = browserId;
        this._browserAgent = new BrowserAgent(browserId, browserPool);
    },

    run: function(suitePaths, filterFn) {
        return _(suitePaths)
            .map(_.bind(this._runSuite, this, _, filterFn))
            .thru(utils.waitForResults)
            .value();
    },

    _runSuite: function(suitePath, filterFn) {
        var suiteRunner = SuiteRunner.create(this._config, this._browserAgent);

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

        return suiteRunner.run(suitePath, filterFn);
    }

}, {
    create: function(config, _browserId, browserPool) {
        return new BrowserRunner(config, _browserId, browserPool);
    }
});

module.exports = BrowserRunner;
