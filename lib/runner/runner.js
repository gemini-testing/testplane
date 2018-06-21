'use strict';

const AsyncEmitter = require('gemini-core').events.AsyncEmitter;

module.exports = class Runner extends AsyncEmitter {
    static create(...args) {
        return new this(...args);
    }

    run() {
        throw new Error('Not implemented');
    }

    cancel() {}
};
