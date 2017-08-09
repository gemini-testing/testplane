'use strict';

const _ = require('lodash');
const qUtils = require('qemitter/utils');
const utils = require('q-promise-utils');
const workerFarm = require('worker-farm');

const RunnerEvents = require('../constants/runner-events');
const logger = require('../utils').logger;
const BaseRunner = require('./base-runner');

module.exports = class MainRunner extends BaseRunner {
    constructor(config) {
        super(config, {
            BrowserPool: require('../browser-pool'),
            MochaRunner: require('./mocha-runner')
        });
    }

    buildSuiteTree(options) {
        return this._mapRevealedSets(options, (files, browserId) => {
            const mochaRunner = this._createMochaRunner(browserId);

            qUtils.passthroughEvent(mochaRunner, this, [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ]);

            return mochaRunner.buildSuiteTree(files);
        });
    }

    run(options) {
        let workers;

        return this.emitAndWait(RunnerEvents.RUNNER_START, this)
            .then(() => workers = this._createWorkerFarm(options))
            .then(() => this._initMochaRunners(options, _.values(RunnerEvents.getSync())))
            .then((mochaRunners) => {
                this.emit(RunnerEvents.BEGIN);

                return _.map(mochaRunners, (mochaRunner) => mochaRunner.run(workers));
            })
            .then(utils.waitForResults)
            .fin(() => {
                workers && workerFarm.end(workers);

                return this.emitAndWait(RunnerEvents.RUNNER_END).catch(logger.warn);
            });
    }

    _createWorkerFarm(options) {
        const workerFilepath = require.resolve('../worker');
        const params = {
            maxConcurrentWorkers: this._config.system.maxConcurrentWorkers,
            maxConcurrentCallsPerWorker: Infinity,
            autoStart: true,
            argv: [JSON.stringify({options, config: this._config})]
        };

        return workerFarm(params, workerFilepath, ['runTest']);
    }
};
