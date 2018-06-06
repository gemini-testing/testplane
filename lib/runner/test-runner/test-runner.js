'use strict';

const {EventEmitter} = require('events');

module.exports = class TestRunner extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }

    run() {
        throw new Error('Not implemented');
    }
};
