'use strict';

var _ = require('lodash'),
    inherit = require('inherit'),
    EventEmitter = require('events').EventEmitter,
    RunnerEvents = require('../constants/runner-events'),
    Matcher = require('./matcher');

var RepeatManager = inherit(EventEmitter, {
    __constructor: function(config) {
        this._repeatLeft = _.mapValues(config.browsers, 'repeat');
        this._matchers = [];
    },

    handleTestPass: function(data) {
        const browserId = data.browserId;
        const repeatLeft = this._repeatLeft[browserId];

        if (!repeatLeft) {
            this.emit(RunnerEvents.TEST_PASS, data);
            return;
        }

        this.emit(RunnerEvents.REPEAT, _.extend(data, {
            repeatLeft: repeatLeft - 1
        }));

        this._registerPass(data, browserId);
    },

    _registerPass: function(runnable, browser) {
        if (runnable.type === 'test') {
            this._matchers.push(Matcher.create(runnable, browser));
        }
    },

    repeat: function(runFn) {
        if (_.isEmpty(this._matchers)) {
            return;
        }

        this._repeatLeft = _.mapValues(this._repeatLeft, function(repeat) {
            return repeat && repeat - 1;
        });

        var matchers = this._matchers,
            testsToRepeat = this._getTestsToRepeat();

        this._matchers = [];

        return runFn(testsToRepeat, function(test, browser) {
            return _.any(matchers, function(matcher) {
                return matcher.test(_.extend(test, {
                    isRepeat: true
                }), browser);
            });
        });
    },

    _getTestsToRepeat: function() {
        return _(this._matchers)
            .groupBy('browser')
            .mapValues(function(matchers) {
                return _(matchers).map('file').uniq().value();
            })
            .value();
    }
});

module.exports = RepeatManager;
