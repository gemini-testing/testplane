'use strict';

var MochaAdapter = require('./mocha-adapter'),
    utils = require('q-promise-utils'),
    QEmitter = require('qemitter'),

    _ = require('lodash'),
    inherit = require('inherit');

var MochaRunner = inherit(QEmitter, {
    __constructor: function(config, browserAgent) {
        this._sharedMochaOpts = config.mochaOpts;
        this._browserAgent = browserAgent;
    },

    run: function(suitePaths, filterFn) {
        return _(suitePaths)
            .map(_.bind(this._createMocha, this, _, filterFn))
            .map(function(mocha) {
                return mocha.run();
            })
            .thru(utils.waitForResults)
            .value();
    },

    _createMocha: function(suiteFile, filterFn) {
        return MochaAdapter.create(this._sharedMochaOpts, this._browserAgent)
            .attachTestFilter(filterFn)
            .addFile(suiteFile)
            .attachEmitFn(this.emit.bind(this));
    }
}, {
    create: function(config, browserAgent) {
        return new MochaRunner(config, browserAgent);
    }
});

module.exports = MochaRunner;
