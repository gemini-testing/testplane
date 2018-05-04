'use strict';

const _ = require('lodash');
const utils = require('q-promise-utils');
const AsyncEmitter = require('gemini-core').events.AsyncEmitter;
const eventsUtils = require('gemini-core').events.utils;
const {temp} = require('gemini-core');

const BrowserPool = require('../browser-pool');
const RuntimeConfig = require('../config/runtime-config');
const RunnerStats = require('../stats');
const RunnerEvents = require('../constants/runner-events');
const MochaRunner = require('./mocha-runner');
const TestSkipper = require('./test-skipper');
const logger = require('../utils/logger');
const Workers = require('./workers');

module.exports = class MainRunner extends AsyncEmitter {
    static create(config) {
        return new MainRunner(config);
    }

    constructor(config) {
        super();

        this._config = config;
        this._testSkipper = TestSkipper.create(this._config);
        this._browserPool = BrowserPool.create(this._config, this);
        this._stats = RunnerStats.create();

        temp.init(this._config.system.tempDir);
        RuntimeConfig.getInstance().extend({tempOpts: temp.serialize()});

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
        const workers = Workers.create(this._config);

        return this.emitAndWait(RunnerEvents.RUNNER_START, this)
            .then(() => {
                const mochaRunners = this._initMochaRunners(testFiles);
                this.emit(RunnerEvents.BEGIN);
                return _.map(mochaRunners, (mochaRunner) => mochaRunner.run(workers));
            })
            .then(utils.waitForResults)
            .finally(() => {
                workers.end();

                return this.emitAndWait(RunnerEvents.RUNNER_END, this._stats.getResult())
                    .catch(logger.warn);
            });
    }

    cancel() {
        this._browserPool.cancel();

        this._config.getBrowserIds().forEach((browserId) => {
            this._config.forBrowser(browserId).shouldRetry = () => false;
        });
    }

    _initMochaRunners(testFiles) {
        return _.mapValues(testFiles, (files, browserId) => this._createMochaRunner(browserId).init(files));
    }

    _createMochaRunner(browserId) {
        const mochaRunner = MochaRunner.create(browserId, this._config, this._browserPool, this._testSkipper);

        eventsUtils.passthroughEvent(mochaRunner, this, _.values(RunnerEvents.getSync()));
        this._stats.attachRunner(mochaRunner);

        return mochaRunner;
    }
};
