'use strict';

var Runner = require('./runner'),
    HermioneFacade = require('./hermione-facade'),
    RunnerEvents = require('./constants/runner-events'),
    pathUtils = require('./path-utils'),
    logger = require('./utils').logger,
    _ = require('lodash'),
    q = require('q'),
    inherit = require('inherit'),
    qDebugMode = require('q-debug-mode'),
    util = require('util'),
    chalk = require('chalk');

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
        browsers = this._filterBrowsers(browsers, _.keys(this._config.browsers));

        if (this._config.debug) {
            qDebugMode(q);
        }

        var runner = Runner.create(this._config);
        runner.on(RunnerEvents.TEST_FAIL, this._fail.bind(this));
        runner.on(RunnerEvents.ERROR, this._fail.bind(this));

        this._config.reporters.forEach(_.partial(applyReporter, runner));

        this._loadPlugins(runner);

        return this._getTests(testPaths)
            .then(function(tests) {
                return runner.run(tests, browsers);
            })
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
    },

    _filterBrowsers: function(browsers, allBrowsers) {
        if (!browsers) {
            return allBrowsers;
        }

        var unknownBrowsers = _.difference(browsers, allBrowsers);
        if (unknownBrowsers.length) {
            logger.warn(util.format(
                '%s Unknown browsers id: %s. Use one of the browser ids specified in config file: %s',
                chalk.yellow('WARNING:'), unknownBrowsers.join(', '), allBrowsers.join(', ')
            ));
        }

        return _.intersection(browsers, allBrowsers);
    },

    _getTests: function(paths) {
        if (_.isEmpty(paths)) {
            paths = this._config.specs;
        }

        return pathUtils.expandPaths(paths);
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
