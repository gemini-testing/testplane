'use strict';

const _ = require('lodash');

module.exports = class TestCollection {
    static create(...args) {
        return new this(...args);
    }

    constructor(specs) {
        this._specs = specs;
    }

    getRootSuite(browserId) {
        const test = this._specs[browserId][0];
        return test && test.parent && this._getRoot(test.parent);
    }

    eachRootSuite(cb) {
        _.forEach(this._specs, (tests, browserId) => {
            const root = this.getRootSuite(browserId);
            if (root) {
                cb(root, browserId);
            }
        });
    }

    _getRoot(suite) {
        return suite.root ? suite : this._getRoot(suite.parent);
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

    sortTests(browserId, cb) {
        if (_.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }

        if (browserId) {
            if (this._specs[browserId].length) {
                this._specs[browserId].sort(cb);
            }
        } else {
            this.getBrowsers().forEach((browserId) => this.sortTests(browserId, cb));
        }

        return this;
    }

    eachTest(browserId, cb) {
        if (_.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }

        if (browserId) {
            this._specs[browserId].forEach((test) => cb(test, browserId));
        } else {
            this.getBrowsers().forEach((browserId) => this.eachTest(browserId, cb));
        }
    }

    disableAll(browserId) {
        if (browserId) {
            this.eachTest(browserId, (test) => this._disableTest(test));
        } else {
            this.getBrowsers().forEach((browserId) => this.disableAll(browserId));
        }

        return this;
    }

    _disableTest(test) {
        if (!test._restoreDisabledProperty) {
            const {disabled} = test;
            test._restoreDisabledProperty = typeof disabled === 'boolean'
                ? () => test.disabled = disabled
                : () => delete test.disabled;
        }

        test.disabled = true;

        return this;
    }

    disableTest(fullTitle, browserId) {
        if (typeof fullTitle === 'object') {
            return this._disableTest(fullTitle);
        }

        if (browserId) {
            const test = this._findTest(fullTitle, browserId);
            if (test) {
                this._disableTest(test);
            }
        } else {
            this.getBrowsers().forEach((browserId) => this.disableTest(fullTitle, browserId));
        }

        return this;
    }

    _findTest(fullTitle, browserId) {
        return this._specs[browserId].find((test) => test.fullTitle() === fullTitle);
    }

    enableAll(browserId) {
        if (browserId) {
            this.eachTest(browserId, (test) => this._enableTest(test));
        } else {
            this.getBrowsers().forEach((browserId) => this.enableAll(browserId));
        }

        return this;
    }

    _enableTest(test) {
        if (test._restoreDisabledProperty) {
            test._restoreDisabledProperty();
        }

        return this;
    }

    enableTest(fullTitle, browserId) {
        if (typeof fullTitle === 'object') {
            return this._enableTest(fullTitle);
        }

        if (browserId) {
            const test = this._findTest(fullTitle, browserId);
            if (test) {
                this._enableTest(test);
            }
        } else {
            this.getBrowsers().forEach((browserId) => this.enableTest(fullTitle, browserId));
        }

        return this;
    }
};
