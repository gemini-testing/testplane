'use strict';

var Runner = require('./runner'),
    HermioneFacade = require('./hermione-facade'),
    RunnerEvents = require('./constants/runner-events'),
    readTests = require('./tests-reader'),
    _ = require('lodash'),
    inherit = require('inherit');

// Hack for node@0.10 and lower
// Remove restriction for maximum open concurrent sockets
require('http').globalAgent.maxSockets = Infinity;

process.on('uncaughtException', function(err) {
    console.error(err.stack);
});

module.exports = inherit({
    __constructor: function(config) {
        this._config = config;
        this._failed = false;
    },

    run: function(testPaths, browsers) {
        var runner = Runner.create(this._config);
        runner.on(RunnerEvents.TEST_FAIL, this._fail.bind(this));
        runner.on(RunnerEvents.ERROR, this._fail.bind(this));

        this._config.reporters.forEach(_.partial(applyReporter, runner));

        this._loadPlugins(runner);

        return readTests(testPaths, browsers, this._config)
            .then(runner.run.bind(runner))
            .then(function() {
                return !this._failed;
            }.bind(this));
    },

    _loadPlugins: function(runner) {
        require('./plugins').load(
            new HermioneFacade(runner, this._config)
        );
    },

    _fail: function() {
        this._failed = true;
    }
});

function applyReporter(runner, reporter) {
    if (typeof reporter === 'string') {
        try {
            reporter = require('./reporters/' + reporter);
        } catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                throw new Error('No such reporter: ' + reporter);
            }
            throw e;
        }
    }
    if (typeof reporter !== 'function') {
        throw new TypeError('Reporter must be a string or a function');
    }

    var Reporter = reporter;

    new Reporter().attachRunner(runner);
}
