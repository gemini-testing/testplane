'use strict';

var _ = require('lodash'),
    inherit = require('inherit'),
    chalk = require('chalk'),

    logger = require('../utils').logger,

    RunnerEvents = require('../constants/runner-events'),

    ICON_SUCCESS = chalk.green('\u2713'),
    ICON_FAIL = chalk.red('\u2718'),
    ICON_WARN = chalk.bold.yellow('!'),
    ICON_RETRY = chalk.yellow('⟳');

const getSkipReason = (test, skipReason) => test && (getSkipReason(test.parent) || test.skipReason) || skipReason;

module.exports = inherit({
    __constructor: function() {
        this._passed = this._failed = this._pending = this._retries = 0;
    },

    attachRunner: function(runner) {
        runner.on(RunnerEvents.TEST_PASS, (test) => this._onTestPass(test));
        runner.on(RunnerEvents.TEST_FAIL, (test) => this._onTestFail(test));
        runner.on(RunnerEvents.SUITE_FAIL, (suite) => this._onTestFail(suite));
        runner.on(RunnerEvents.RETRY, (test) => this._onRetry(test));
        runner.on(RunnerEvents.TEST_PENDING, (test) => this._onTestPending(test));
        runner.on(RunnerEvents.RUNNER_END, () => this._onRunnerEnd());

        runner.on(RunnerEvents.WARNING, (info) => this._onWarning(info));
        runner.on(RunnerEvents.ERROR, (error) => this._onError(error));
        runner.on(RunnerEvents.INFO, (info) => this._onInfo(info));
    },

    _onTestPass: function(test) {
        this._passed++;
        logger.log(ICON_SUCCESS + this._formatTestInfo(test));
    },

    _onTestFail: function(test) {
        this._failed++;
        logger.log(ICON_FAIL + this._formatTestInfo(test));
        this._logError(test);
    },

    _onRetry: function(test) {
        this._retries++;
        logger.log(ICON_RETRY + this._formatTestInfo(test));
        this._logError(test);
        logger.log('Will be retried. Retries left: %s', chalk.yellow(test.retriesLeft));
    },

    _logError: function(test) {
        logger.log(chalk.red(test.err && test.err.stack || test.err));
    },

    _onTestPending: function(test) {
        this._pending++;
        logger.log(ICON_WARN + this._formatTestInfo(test));
    },

    _onRunnerEnd: function() {
        var total = this._passed + this._failed + this._pending;

        logger.log('Total: %s Passed: %s Failed: %s Pending: %s Retries: %s',
            chalk.underline(total),
            chalk.green(this._passed),
            chalk.red(this._failed),
            chalk.cyan(this._pending),
            chalk.yellow(this._retries)
        );
    },

    _onWarning: function(info) {
        logger.warn(info);
    },

    _onError: function(error) {
        logger.error(chalk.red(error));
    },

    _onInfo: function(info) {
        logger.log(info);
    },

    _formatTestInfo: function(test) {
        let tmpl = this._getTmpl(test.sessionId);

        if (test.pending) {
            tmpl += ' reason: ${chalk.red(reason)}';
        }

        return this._compile(tmpl, {
            suiteName: test.fullTitle().replace(test.title, ''),
            testName: test.title,
            bId: test.browserId,
            sId: test.sessionId,
            duration: test.duration || 0,
            reason: getSkipReason(test) || 'no comment'
        });
    },

    _getTmpl: function(sessionId) {
        if (sessionId) {
            return ' ${suiteName}${chalk.underline(testName)} ' +
                '[${chalk.yellow(bId)}:${chalk.blue(sId)}] - ' +
                '${chalk.cyan(duration)}ms';
        }

        return ' ${suiteName}${chalk.underline(testName)} ' +
                '[${chalk.yellow(bId)}] - ' +
                '${chalk.cyan(duration)}ms';
    },

    _compile: function(tmpl, data) {
        return _.template(tmpl, {
            imports: {
                chalk: chalk
            }
        })(data);
    }
});
