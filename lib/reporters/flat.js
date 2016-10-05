'use strict';

const chalk = require('chalk');
const _ = require('lodash');
const path = require('path');

const logger = require('../utils').logger;

const RunnerEvents = require('../constants/runner-events');

const ICON_SUCCESS = chalk.green('\u2713');
const ICON_FAIL = chalk.red('\u2718');
const ICON_WARN = chalk.bold.yellow('!');
const ICON_RETRY = chalk.yellow('⟳');

const getSkipReason = (test, skipReason) => test && (getSkipReason(test.parent) || test.skipReason) || skipReason;

const getRelativeFilePath = (file) => {
    return file ? path.relative(process.cwd(), file) : 'undefined';
};

module.exports = class FlatReporter {
    constructor() {
        this._passed = this._failed = this._pending = this._retries = 0;
        this._tests = [];
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

        this._tests.push(FlatReporter._extendTestInfo(test, {isFailed: true}));
    }

    _onRetry(test) {
        this._retries++;
        logger.log(ICON_RETRY + this._formatTestInfo(test));
        logger.log('Will be retried. Retries left: %s', chalk.yellow(test.retriesLeft));

        this._tests.push(FlatReporter._extendTestInfo(test, {isFailed: false}));
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

        FlatReporter._logFailedTestsInfo(this._tests);
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

    static _logFailedTestsInfo(tests) {
        const failedTests = this._formatFailedTests(tests);

        failedTests.forEach((test, index) => {
            logger.log(`\n${index + 1}) ${test.title}`);
            logger.log(`   in file ${test.file}\n`);

            _.forEach(test.browsers, (testCase) => {
                const icon = testCase.isFailed ? ICON_FAIL : ICON_RETRY;

                logger.log(`   ${testCase.browser}`);
                logger.log(`     ${icon} ${testCase.error}`);
            });
        });
    }

    static _formatFailedTests(tests) {
        const formattedTests = [];

        tests.forEach((test) => {
            const testItem = _.pick(test, ['title', 'file']);

            if (_.find(formattedTests, testItem)) {
                return;
            }

            const browsers = _.filter(tests, testItem);
            formattedTests.push(_.extend(testItem, {browsers}));
        });

        return formattedTests;
    }

    static _extendTestInfo(test, opts) {
        return _.extend(this._getTestInfo(test), opts);
    }

    static _getTestInfo(test) {
        return {
            title: test.fullTitle(),
            browser: test.browserId,
            file: getRelativeFilePath(test.file),
            error: _.get(test, 'err.stack', test.err)
        };
    }

};
