'use strict';

const _ = require('lodash');
const validators = require('../validators');
const env = require('../utils/env');

module.exports = class TestSkipper {
    static create(config) {
        return new TestSkipper(config);
    }

    static _validateUnknownBrowsers(skipBrowsers, browsers) {
        validators.validateUnknownBrowsers(skipBrowsers, browsers);
    }

    constructor(config) {
        this._skipBrowsers = env.parseCommaSeparatedValue('HERMIONE_SKIP_BROWSERS');

        TestSkipper._validateUnknownBrowsers(this._skipBrowsers, this._getBrowsersFromConfig(config));
    }

    applySkip(suite, browserId) {
        if (this._shouldBeSkipped(browserId)) {
            suite.pending = true;
            suite.skipReason = 'The test was skipped by environment variable HERMIONE_SKIP_BROWSERS';
        }
    }

    _shouldBeSkipped(browserId) {
        return _.includes(this._skipBrowsers, browserId);
    }

    _getBrowsersFromConfig(config) {
        return _.keys(config.browsers);
    }
};
