'use strict';

var q = require('q'),
    inherit = require('inherit'),
    Runner = require('./runner'),
    FlatReporter = require('./reporters/flat'),
    qDebugMode = require('q-debug-mode');

// Hack for node@0.10 and lower
// Remove restriction for maximum open concurrent sockets
require('http').globalAgent.maxSockets = Infinity;

module.exports = inherit({
    __constructor: function(config) {
        this._config = config;
        this._runner = Runner.create(this._config);
    },

    run: function() {
        if (this._config.debug) {
            qDebugMode(q);
        }

        var reporter = new FlatReporter();
        reporter.attachRunner(this._runner);
        return this._runner.run();
    }
});
