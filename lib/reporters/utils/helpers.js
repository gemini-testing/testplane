'use strict';

const path = require('path');

const chalk = require('chalk');
const _ = require('lodash');

const logger = require('../../utils').logger;
const icons = require('./icons');

const getSkipReason = (test) => test && (getSkipReason(test.parent) || test.skipReason);
const getFilePath = (test) => test && test.file || test.parent && getFilePath(test.parent);
const getRelativeFilePath = (file) => file ? path.relative(process.cwd(), file) : undefined;

exports.formatTestInfo = (test) => {
    const suiteName = test.fullTitle().replace(test.title, '');
    const sessionId = test.sessionId ? `:${test.sessionId}` : '';
    const reason = test.pending && ` reason: ${chalk.red(getSkipReason(test) || 'no comment')}`;

    return ` ${suiteName}${chalk.underline(test.title)} [${chalk.yellow(test.browserId)}` +
        `${sessionId}] - ${chalk.cyan(test.duration || 0)}ms${reason || ''}`;
};

exports.getTestInfo = (test) => {
    const file = getFilePath(test);

    return {
        title: test.fullTitle(),
        browser: test.browserId,
        file: getRelativeFilePath(file),
        error: test.err ? (test.err.stack || test.err.message || test.err) : undefined
    };
};

exports.extendTestInfo = (test, opts) => {
    return _.extend(exports.getTestInfo(test), opts);
};

exports.formatFailedTests = (tests) => {
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

exports.logFailedTestsInfo = (tests) => {
    const failedTests = exports.formatFailedTests(tests);

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
