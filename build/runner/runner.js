'use strict';
const AsyncEmitter = require('../core/events/async-emitter').default;
module.exports = class Runner extends AsyncEmitter {
    static create(...args) {
        return new this(...args);
    }
    run() {
        throw new Error('Not implemented');
    }
    cancel() { }
};
