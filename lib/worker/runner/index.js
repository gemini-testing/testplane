'use strict';

const _ = require('lodash');
const RunnerEvents = require('../../constants/runner-events').subprocess();
const BaseRunner = require('../../runner/base-runner');

module.exports = class MainRunner extends BaseRunner {
    constructor(config) {
        super(config, {
            BrowserPool: require('../browser-pool'),
            MochaRunner: require('./mocha-runner')
        });
    }

    init(options) {
        return this._initMochaRunners(options, _.values(RunnerEvents))
            .then((mochaRunners) => this._mochaRunners = mochaRunners);
    }

    runTest(fullTitle, options) {
        return this._mochaRunners[options.browserId].runTest(fullTitle, options.sessionId);
    }
};
