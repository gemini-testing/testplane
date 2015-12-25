'use strict';

var _ = require('lodash'),
    inherit = require('inherit'),
    chalk = require('chalk'),

    logger = require('../utils').logger,

    RunnerEvents = require('../constants/runner-events'),

    ICON_SUCCESS = chalk.green('\u2713'),
    ICON_FAIL = chalk.red('\u2718'),
    ICON_WARN = chalk.bold.yellow('!');

module.exports = inherit({
    __constructor: function() {
        this._passed = this._failed = this._pending = 0;
    },

    attachRunner: function(runner) {
        runner.on(RunnerEvents.TEST_PASS, this._onTestPass.bind(this));
        runner.on(RunnerEvents.TEST_FAIL, this._onTestFail.bind(this));
        runner.on(RunnerEvents.TEST_PENDING, this._onTestPending.bind(this));
        runner.on(RunnerEvents.RUNNER_END, this._onRunnerEnd.bind(this));

        runner.on(RunnerEvents.WARNING, this._onWarning.bind(this));
        runner.on(RunnerEvents.ERROR, this._onError.bind(this));
        runner.on(RunnerEvents.INFO, this._onInfo.bind(this));
    },

    _onTestPass: function(test) {
        this._passed++;
        logger.log(ICON_SUCCESS + this._formatTestInfo(test));
    },

    _onTestFail: function(test) {
        this._failed++;
        logger.log(ICON_FAIL + this._formatTestInfo(test));
        logger.log(chalk.red(test.error));
    },

    _onTestPending: function(test) {
        this._pending++;
        logger.log(ICON_WARN + this._formatTestInfo(test));
    },

    _onRunnerEnd: function() {
        var total = this._passed + this._failed + this._pending;

        logger.log('Total: %s Passed: %s Failed: %s Pending: %s',
            chalk.underline(total),
            chalk.green(this._passed),
            chalk.red(this._failed),
            chalk.cyan(this._pending)
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
        var tmpl = ' ${suiteName}${chalk.underline(testName)} ' +
            '[${chalk.yellow(bId)}:${chalk.blue(sId)}] - ' +
            '${chalk.cyan(duration)}ms';

        return this._compile(tmpl, {
            suiteName: test.fullTitle().replace(test.title, ''),
            testName: test.title,
            bId: test.browserId,
            sId: test.sessionId,
            duration: test.duration || 0
        });
    },

    _compile: function(tmpl, data) {
        return _.template(tmpl, {
            imports: {
                chalk: chalk
            }
        })(data);
    }
});
