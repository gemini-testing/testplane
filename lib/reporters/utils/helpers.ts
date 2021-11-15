import path from 'path';
import chalk from 'chalk';
import _ from 'lodash';

import * as icons from './icons';
import * as logger from '../../utils/logger';

import type Mocha from '@gemini-testing/mocha';

const getSkipReason = (test?: Mocha.Runnable | Mocha.Suite) => test && (getSkipReason(test.parent) || test.skipReason);
const getFilePath = (test: Mocha.Test) => test && test.file || test.parent && getFilePath(test.parent);
const getRelativeFilePath = (file?: string): string | undefined => file ? path.relative(process.cwd(), file) : undefined;

const getTestError = (test: Mocha.Test): Error | string | undefined => {
    let error = test.err ? (test.err.stack || test.err.message || test.err) : undefined;

    if (test.err && test.err.seleniumStack) {
        error = error.replace(/$/m, ` (${test.err.seleniumStack.orgStatusMessage})`);
    }

    return error;
};

export const formatTestInfo = (test): string => {
    const suiteName = test.fullTitle().replace(test.title, '');
    const sessionId = test.sessionId ? `:${test.sessionId}` : '';
    const reason = test.pending && ` reason: ${chalk.red(getSkipReason(test) || 'no comment')}`;

    return ` ${suiteName}${chalk.underline(test.title)} [${chalk.yellow(test.browserId)}` +
        `${sessionId}] - ${chalk.cyan(test.duration || 0)}ms${reason || ''}`;
};

type TestInfo = {
    title: string;
    browser: string;
    file?: string;
    error: Error | string | undefined;
};

export const getTestInfo = (test: Mocha.Test): TestInfo => {
    const file = getFilePath(test);

    return {
        title: test.fullTitle(),
        browser: test.browserId,
        file: getRelativeFilePath(file),
        error: getTestError(test)
    };
};

export const extendTestInfo = <T extends object>(test, opts: T): TestInfo & T => {
    return _.extend(getTestInfo(test), opts);
};

export const formatFailedTests = (tests) => {
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
};

export const logFailedTestsInfo = (tests): void => {
    const failedTests = formatFailedTests(tests);

    failedTests.forEach((test, index) => {
        logger.log(`\n${index + 1}) ${test.title}`);
        logger.log(`   in file ${test.file}\n`);

        _.forEach(test.browsers, (testCase) => {
            const icon = testCase.isFailed ? icons.FAIL : icons.RETRY;

            logger.log(`   ${testCase.browser}`);
            logger.log(`     ${icon} ${testCase.error}`);
        });
    });
};
