'use strict';

const _ = require('lodash');
const q = require('q');
const utils = require('q-promise-utils');
const AsyncEmitter = require('gemini-core').events.AsyncEmitter;
const eventsUtils = require('gemini-core').events.utils;
const workerFarm = require('worker-farm');

const BrowserPool = require('../browser-pool');
const RunnerEvents = require('../constants/runner-events');
const MochaRunner = require('./mocha-runner');
const TestSkipper = require('./test-skipper');
const logger = require('../utils/logger');

module.exports = class MainRunner extends AsyncEmitter {
    static create(config) {
        return new MainRunner(config);
    }

    constructor(config) {
        super();

        this._config = config;
        this._testSkipper = TestSkipper.create(this._config);
        this._browserPool = BrowserPool.create(this._config, this);

        MochaRunner.prepare();
    }

    buildSuiteTree(testFiles) {
        return _.mapValues(testFiles, (files, browserId) => {
            const mochaRunner = MochaRunner.create(browserId, this._config, this._browserPool, this._testSkipper);

            eventsUtils.passthroughEvent(mochaRunner, this, [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ]);

            return mochaRunner.buildSuiteTree(files);
        });
    }

    run(testFiles) {
        const workers = this._createWorkerFarm();

        return q
            .all([
                this.emitAndWait(RunnerEvents.RUNNER_START, this),
                q.ninvoke(workers, 'init', testFiles, this._config.configPath)
            ])
            .then(() => q.ninvoke(workers, 'syncConfig', this._config.serialize()))
            .then(() => {
                const mochaRunners = this._initMochaRunners(testFiles);
                this.emit(RunnerEvents.BEGIN);
                return _.map(mochaRunners, (mochaRunner) => mochaRunner.run(workers));
            })
            .then(utils.waitForResults)
            .finally(() => {
                workers && workerFarm.end(workers);

                return this.emitAndWait(RunnerEvents.RUNNER_END).catch(logger.warn);
            });
    }

    _createWorkerFarm() {
        const workerFilepath = require.resolve('../worker');
        const params = {
            maxConcurrentWorkers: this._config.system.workers,
            maxConcurrentCallsPerWorker: Infinity,
            autoStart: true
        };

        return workerFarm(params, workerFilepath, [
            {name: 'init', broadcast: true},
            {name: 'syncConfig', broadcast: true},
            'runTest'
        ]);
    }

    _initMochaRunners(testFiles) {
        return _.mapValues(testFiles, (files, browserId) => this._createMochaRunner(browserId).init(files));
    }

    _createMochaRunner(browserId) {
        const mochaRunner = MochaRunner.create(browserId, this._config, this._browserPool, this._testSkipper);

        eventsUtils.passthroughEvent(mochaRunner, this, _.values(RunnerEvents.getSync()));

        return mochaRunner;
    }
};
