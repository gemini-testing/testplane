'use strict';

const _ = require('lodash');

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
        if (_.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }

        const results = [];
        this.eachTest(browserId, (test, browserId) => results.push(cb(test, browserId)));

        return results;
    }

    eachTest(browserId, cb) {
        if (_.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }

        if (browserId) {
            this._specs[browserId].forEach((test) => cb(test, browserId));
            return;
        }

        _.forEach(this._specs, (tests, browserId) => {
            tests.forEach((test) => cb(test, browserId));
        });
    }
};
