'use strict';

var _ = require('lodash'),
    q = require('q'),
    inherit = require('inherit'),
    Runner = require('./runner'),
    pathUtils = require('./path-utils'),
    qDebugMode = require('q-debug-mode'),
    logger = require('./utils').logger,
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
        this._runner = Runner.create(this._config);
    },

    run: function(testPaths, browsers) {
        browsers = this._filterBrowsers(browsers, _.keys(this._config.browsers));

        if (this._config.debug) {
            qDebugMode(q);
        }

        this._config.reporters.forEach(_.partial(applyReporter, this._runner));

        var _this = this;
        return this._getTests(testPaths)
            .then(function(tests) {
                return _this._runner.run(tests, browsers);
            });
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
