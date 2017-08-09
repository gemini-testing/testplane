'use strict';

const _ = require('lodash');
const BaseMochaRunner = require('../../../runner/mocha-runner/base-mocha-runner');

module.exports = class MochaRunner extends BaseMochaRunner {
    constructor(browserId, config, browserPool, testSkipper) {
        super(browserId, config, browserPool, testSkipper, {
            MochaBuilder: require('./mocha-builder')
        });
    }

    runTest(fullTitle, sessionId) {
        const mocha = _.find(this._mochas, (mocha) => {
            const titles = mocha.tests.map((test) => test.fullTitle());

            return _.includes(titles, fullTitle);
        });

        return mocha.runInSession(sessionId);
    }
};
