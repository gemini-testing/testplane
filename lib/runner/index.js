'use strict';

const _ = require('lodash');
const utils = require('q-promise-utils');
const QEmitter = require('qemitter');
const qUtils = require('qemitter/utils');

const BrowserAgent = require('../browser-agent');
const BrowserPool = require('../browser-pool');
const RunnerEvents = require('../constants/runner-events');
const MochaRunner = require('./mocha-runner');
const TestSkipper = require('./test-skipper');
const logger = require('../utils').logger;

module.exports = class MainRunner extends QEmitter {
    static create(config) {
        return new MainRunner(config);
    }

    constructor(config) {
        super();

        this._config = config;
        this._testSkipper = TestSkipper.create(this._config);
        this._pool = new BrowserPool(this._config);

        MochaRunner.prepare();
    }

    buildSuiteTree(tests) {
        return _.mapValues(tests, (files, browserId) => {
            const browserAgent = BrowserAgent.create(browserId, this._pool);
            const mochaRunner = MochaRunner.create(this._config, browserAgent, this._testSkipper);

            qUtils.passthroughEvent(mochaRunner, this, [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ]);

            return mochaRunner.buildSuiteTree(files);
        });
    }

    run(tests) {
        return this.emitAndWait(RunnerEvents.RUNNER_START, this)
            .then(() => {
                const mochaRunners = this._initMochaRunners(tests);
                this.emit(RunnerEvents.BEGIN);
                return mochaRunners.map((mochaRunner) => mochaRunner.run());
            })
            .then(utils.waitForResults)
            .fin(() => this.emitAndWait(RunnerEvents.RUNNER_END).catch(logger.warn));
    }

    _initMochaRunners(tests) {
        return _.map(tests, (files, browserId) => this._initMochaRunner(browserId).init(files));
    }

    _initMochaRunner(browserId) {
        const browserAgent = BrowserAgent.create(browserId, this._pool);
        const mochaRunner = MochaRunner.create(this._config, browserAgent, this._testSkipper);

        qUtils.passthroughEvent(mochaRunner, this, _.values(RunnerEvents.getSync()));
        qUtils.passthroughEventAsync(browserAgent, this, [
            RunnerEvents.SESSION_START,
            RunnerEvents.SESSION_END
        ]);

        return mochaRunner;
    }
};
