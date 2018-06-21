'use strict';

module.exports = class TestCollection {
    static create(...args) {
        return new this(...args);
    }

    constructor(specs) {
        this._specs = specs;
    }

    getBrowsers() {
        return Object.keys(this._specs);
    }

    mapTests(browserId, cb) {
        return this._specs[browserId].map(cb);
    }
};
