'use strict';

const chalk = require('chalk');

const logger = require('../utils').logger;

const RunnerEvents = require('../constants/runner-events');

const ICON_SUCCESS = chalk.green('\u2713');
const ICON_FAIL = chalk.red('\u2718');
const ICON_WARN = chalk.bold.yellow('!');
const ICON_RETRY = chalk.yellow('⟳');

const getSkipReason = (test, skipReason) => test && (getSkipReason(test.parent) || test.skipReason) || skipReason;

module.exports = class FlatReporter {
    constructor() {
        this._passed = this._failed = this._pending = this._retries = 0;
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
        this._passed++;
        logger.log(ICON_SUCCESS + this._formatTestInfo(test));
    }

    _onTestFail(test) {
        this._failed++;
        logger.log(ICON_FAIL + this._formatTestInfo(test));
        this._logError(test);
    }

    _onRetry(test) {
        this._retries++;
        logger.log(ICON_RETRY + this._formatTestInfo(test));
        this._logError(test);
        logger.log('Will be retried. Retries left: %s', chalk.yellow(test.retriesLeft));
    }

    _logError(test) {
        logger.log(chalk.red(test.err && test.err.stack || test.err));
    }

    _onTestPending(test) {
        this._pending++;
        logger.log(ICON_WARN + this._formatTestInfo(test));
    }

    _onRunnerEnd() {
        const total = this._passed + this._failed + this._pending;

        logger.log('Total: %s Passed: %s Failed: %s Pending: %s Retries: %s',
            chalk.underline(total),
            chalk.green(this._passed),
            chalk.red(this._failed),
            chalk.cyan(this._pending),
            chalk.yellow(this._retries)
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

    _formatTestInfo(test) {
        const suiteName = test.fullTitle().replace(test.title, '');
        const sessionId = test.sessionId ? `:${test.sessionId}` : '';
        const reason = test.pending && ` reason: ${chalk.red(getSkipReason(test) || 'no comment')}`;

        return ` ${suiteName}${chalk.underline(test.title)} [${chalk.yellow(test.browserId)}` +
            `${sessionId}] - ${chalk.cyan(test.duration || 0)}ms${reason || ''}`;
    }
};
