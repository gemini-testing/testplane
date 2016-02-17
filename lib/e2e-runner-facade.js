'use strict';

var RunnerEvents = require('./constants/runner-events'),
    signalHandler = require('./signal-handler'),
    inherit = require('inherit'),
    QEmitter = require('qemitter'),
    passthroughEvent = require('qemitter/utils').passthroughEvent,
    _ = require('lodash');

module.exports = inherit(QEmitter, {
    __constructor: function(runner, config) {
        this.config = config;
        this.events = _.extend(_.clone(RunnerEvents), {EXIT: 'exit'});

        passthroughEvent(runner, this, _.values(RunnerEvents));
        passthroughEvent(signalHandler, this, 'exit');
    }
});
