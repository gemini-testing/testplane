'use strict';

var inherit = require('inherit'),
    Mocha = require('mocha'),
    path = require('path'),
    clearRequire = require('clear-require'),
    q = require('q');

// Avoid mochajs warning about possible EventEmitter memory leak
// https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
// Reason: each mocha runner sets 'uncaughtException' listener
process.setMaxListeners(0);

module.exports = inherit({
    __constructor: function(opts) {
        this._mocha = new Mocha(opts);
        this._mocha.fullTrace();
        this.suite = this._mocha.suite;
    },

    addFile: function(file) {
        this._suiteFile = file;
        this._mocha.addFile(file);
    },

    reporter: function(reporter, opts) {
        this._mocha.reporter(reporter, opts);
    },

    run: function() {
        return q.Promise(function(resolve) {
            clearRequire(path.resolve(this._suiteFile)); // clear require exactly before test file will be required by Mocha

            return this._mocha.run(resolve);
        }.bind(this));
    }
});
