"use strict";

const AsyncEmitter = require("../events/async-emitter");

module.exports = class Runner extends AsyncEmitter {
    static create(...args) {
        return new this(...args);
    }

    run() {
        throw new Error("Not implemented");
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    cancel() {}
};
