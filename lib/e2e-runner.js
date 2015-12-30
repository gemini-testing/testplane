'use strict';

var _ = require('lodash'),
    q = require('q'),
    inherit = require('inherit'),
    Runner = require('./runner'),
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

        this._config.reporters.forEach(_.partial(applyReporter, this._runner));

        return this._runner.run();
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
