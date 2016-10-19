'use strict';

const _ = require('lodash');
const QEmitter = require('qemitter');
const passthroughEvent = require('qemitter/utils').passthroughEvent;
const RunnerEvents = require('./constants/runner-events');
const signalHandler = require('./signal-handler');

module.exports = class HermioneFacade extends QEmitter {
    static create(runner, config) {
        return new HermioneFacade(runner, config);
    }

    constructor(runner, config) {
        super();

        this.config = config;
        this.events = _.extend(_.clone(RunnerEvents), {EXIT: 'exit'});

        passthroughEvent(runner, this, _.values(RunnerEvents));
        passthroughEvent(signalHandler, this, 'exit');
    }
};
