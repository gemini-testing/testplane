'use strict';

const BaseMochaBuilder = require('./base-mocha-builder');

module.exports = class MochaBuilder extends BaseMochaBuilder {
    constructor(browserId, config, browserPool, testSkipper) {
        super(browserId, config, browserPool, testSkipper, {
            BrowserAgent: require('gemini-core').BrowserAgent,
            MochaAdapter: require('../mocha-adapter'),
            SingleTestMochaAdapter: require('../single-test-mocha-adapter')
        });
    }
};
