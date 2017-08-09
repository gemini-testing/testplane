'use strict';

const BaseMochaBuilder = require('../../../runner/mocha-runner/mocha-builder/base-mocha-builder');

module.exports = class MochaBuilder extends BaseMochaBuilder {
    constructor(browserId, config, browserPool, testSkipper) {
        super(browserId, config, browserPool, testSkipper, {
            BrowserAgent: require('../../browser-agent'),
            MochaAdapter: require('./mocha-adapter'),
            SingleTestMochaAdapter: require('./single-test-mocha-adapter')
        });
    }
};
