import chalk from 'chalk';

import * as icons from './utils/icons';
import * as helpers from './utils/helpers';
import RunnerEvents from '../constants/runner-events';
import * as logger from '../utils/logger';

import type Hermione from '../hermione';

export default class BaseReporter {
    attachRunner(runner: Hermione) {
        runner.on(RunnerEvents.TEST_PASS, (test) => this._onTestPass(test));
        runner.on(RunnerEvents.TEST_FAIL, (test) => this._onTestFail(test));
        runner.on(RunnerEvents.RETRY, (test) => this._onRetry(test));
        runner.on(RunnerEvents.TEST_PENDING, (test) => this._onTestPending(test));
        runner.on(RunnerEvents.RUNNER_END, (stats) => this._onRunnerEnd(stats));

        runner.on(RunnerEvents.WARNING, (info) => this._onWarning(info));
        runner.on(RunnerEvents.ERROR, (error) => this._onError(error));
        runner.on(RunnerEvents.INFO, (info) => this._onInfo(info));
    }

    private _onTestPass(test) {
        this._logTestInfo(test, icons.SUCCESS);
    }

    private _onTestFail(test) {
        this._logTestInfo(test, icons.FAIL);
    }

    private _onRetry(test) {
        this._logTestInfo(test, icons.RETRY);
        logger.log('Will be retried. Retries left: %s', chalk.yellow(test.retriesLeft));
    }

    private _onTestPending(test) {
        this._logTestInfo(test, icons.WARN);
    }

    private _onRunnerEnd(stats) {
        const message = [
            `Total: ${chalk.underline(stats.total)}`,
            `Passed: ${chalk.green(stats.passed)}`,
            `Failed: ${chalk.red(stats.failed)}`,
            `Skipped: ${chalk.cyan(stats.skipped)}`,
            `Retries: ${chalk.yellow(stats.retries)}`
        ];

        logger.log(message.join(' '));
    }

    private _onWarning(info) {
        logger.warn(info);
    }

    private _onError(error) {
        logger.error(chalk.red(error));
    }

    private _onInfo(info): void {
        logger.log(info);
    }

    private _logTestInfo(test, icon: string): void {
        logger.log(`${icon}${helpers.formatTestInfo(test)}`);
    }
};
