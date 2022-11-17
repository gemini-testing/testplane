'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const EventEmitter = require('events').EventEmitter;
const promiseUtils = require('../../core/promise-utils');

module.exports = class AsyncEmitter extends EventEmitter {
    emitAndWait(event, ...args) {
        return _(this.listeners(event))
            .map((l) => Promise.method(l).apply(this, args))
            .thru(promiseUtils.waitForResults)
            .value();
    }
};
