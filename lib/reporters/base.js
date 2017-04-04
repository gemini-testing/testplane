'use strict';

const chalk = require('chalk');

const logger = require('../utils').logger;

const RunnerEvents = require('../constants/runner-events');
const TestCounter = require('./utils/test-counter');
const icons = require('./utils/icons');
const helpers = require('./utils/helpers');

module.exports = class BaseReporter {
    constructor() {
        this._testCounter = new TestCounter();
    }

    attachRunner(runner) {
        runner.on(RunnerEvents.TEST_PASS, (test) => this._onTestPass(test));
        runner.on(RunnerEvents.TEST_FAIL, (test) => this._onTestFail(test));
        runner.on(RunnerEvents.SUITE_FAIL, (suite) => this._onTestFail(suite));
        runner.on(RunnerEvents.RETRY, (test) => this._onRetry(test));
        runner.on(RunnerEvents.TEST_PENDING, (test) => this._onTestPending(test));
        runner.on(RunnerEvents.RUNNER_END, () => this._onRunnerEnd());

        runner.on(RunnerEvents.WARNING, (info) => this._onWarning(info));
        runner.on(RunnerEvents.ERROR, (error) => this._onError(error));
        runner.on(RunnerEvents.INFO, (info) => this._onInfo(info));
    }

    _onTestPass(test) {
        this._testCounter.onTestPass(test);

        this._logTestInfo(test, icons.SUCCESS);
    }

    _onTestFail(test) {
        this._testCounter.onTestFail(test);

        this._logTestInfo(test, icons.FAIL);
    }

    _onRetry(test) {
        this._testCounter.onTestRetry(test);

        this._logTestInfo(test, icons.RETRY);
        logger.log('Will be retried. Retries left: %s', chalk.yellow(test.retriesLeft));
    }

    _onTestPending(test) {
        this._testCounter.onTestPending(test);

        this._logTestInfo(test, icons.WARN);
    }

    _onRunnerEnd() {
        const stats = this._testCounter.getResult();

        logger.log('Total: %s Passed: %s Failed: %s Pending: %s Retries: %s',
            chalk.underline(stats.total),
            chalk.green(stats.passed),
            chalk.red(stats.failed),
            chalk.cyan(stats.pending),
            chalk.yellow(stats.retries)
        );
    }

    _onWarning(info) {
        logger.warn(info);
    }

    _onError(error) {
        logger.error(chalk.red(error));
    }

    _onInfo(info) {
        logger.log(info);
    }

    _logTestInfo(test, icon) {
        logger.log(`${icon}${helpers.formatTestInfo(test)}`);
    }
};
