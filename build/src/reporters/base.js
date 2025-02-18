"use strict";
const chalk = require("chalk");
const { MasterEvents } = require("../events");
const icons = require("./utils/icons");
const helpers = require("./utils/helpers");
const { initInformer } = require("./informers");
module.exports = class BaseReporter {
    static async create(opts = {}) {
        const informer = await initInformer(opts);
        return new this(informer, opts);
    }
    constructor(informer) {
        this.informer = informer;
    }
    attachRunner(runner) {
        runner.on(MasterEvents.TEST_PASS, test => this._onTestPass(test));
        runner.on(MasterEvents.TEST_FAIL, test => this._onTestFail(test));
        runner.on(MasterEvents.RETRY, test => this._onRetry(test));
        runner.on(MasterEvents.TEST_PENDING, test => this._onTestPending(test));
        runner.on(MasterEvents.RUNNER_END, stats => this._onRunnerEnd(stats));
        runner.on(MasterEvents.WARNING, info => this._onWarning(info));
        runner.on(MasterEvents.ERROR, error => this._onError(error));
        runner.on(MasterEvents.INFO, info => this._onInfo(info));
    }
    _onTestPass(test) {
        this._logTestInfo(test, icons.SUCCESS);
    }
    _onTestFail(test) {
        this._logTestInfo(test, icons.FAIL);
    }
    _onRetry(test) {
        this._logTestInfo(test, icons.RETRY);
        this.informer.log(`Will be retried. Retries left: ${chalk.yellow(test.retriesLeft)}`);
    }
    _onTestPending(test) {
        this._logTestInfo(test, icons.WARN);
    }
    _onBeforeRunnerEnd(stats) {
        const message = [
            `Total: ${chalk.underline(stats.total)}`,
            `Passed: ${chalk.green(stats.passed)}`,
            `Failed: ${chalk.red(stats.failed)}`,
            `Skipped: ${chalk.cyan(stats.skipped)}`,
            `Retries: ${chalk.yellow(stats.retries)}`,
        ];
        this.informer.log(message.join(" "));
    }
    _onRunnerEnd(stats) {
        this._onBeforeRunnerEnd(stats);
        this.informer.end();
    }
    _onWarning(info) {
        this.informer.warn(info);
    }
    _onError(error) {
        this.informer.error(chalk.red(error));
    }
    _onInfo(info) {
        this.informer.log(info);
    }
    _logTestInfo(test, icon) {
        this.informer.log(`${icon}${helpers.formatTestInfo(test)}`);
    }
};
//# sourceMappingURL=base.js.map