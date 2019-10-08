'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const RunnerEvents = require('../constants/runner-events');
const icons = require('./utils/icons');
const helpers = require('./utils/helpers');

module.exports = class BaseReporter {
    attachRunner(runner) {
        runner.on(RunnerEvents.TEST_PASS, (test) => this._onTestPass(test));
        runner.on(RunnerEvents.TEST_FAIL, (test) => this._onTestFail(test));
        runner.on(RunnerEvents.RETRY, (test) => this._onRetry(test));
        runner.on(RunnerEvents.TEST_PENDING, (test) => this._onTestPending(test));
        runner.on(RunnerEvents.RUNNER_END, (stats) => this._onRunnerEnd(stats));

        runner.on(RunnerEvents.WARNING, (info) => this._onWarning(info));
        runner.on(RunnerEvents.ERROR, (error) => this._onError(error));
        runner.on(RunnerEvents.INFO, (info) => this._onInfo(info));
    }

    _onTestPass(test) {
        this._logTestInfo(test, icons.SUCCESS);
    }

    _onTestFail(test) {
        this._logTestInfo(test, icons.FAIL);
    }

    _onRetry(test) {
        this._logTestInfo(test, icons.RETRY);
        logger.log('Test retry %s failed. Will be retried', chalk.yellow(test.retriesPerformed));
    }

    _onTestPending(test) {
        this._logTestInfo(test, icons.WARN);
    }

    _onRunnerEnd(stats) {
        const message = [
            `Total: ${chalk.underline(stats.total)}`,
            `Passed: ${chalk.green(stats.passed)}`,
            `Failed: ${chalk.red(stats.failed)}`,
            `Skipped: ${chalk.cyan(stats.skipped)}`,
            `Retries: ${chalk.yellow(stats.retries)}`
        ];

        logger.log(message.join(' '));
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
