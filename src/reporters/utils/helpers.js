"use strict";

const path = require("path");
const chalk = require("chalk");
const stripAnsi = require("strip-ansi");
const _ = require("lodash");
const util = require("util");

const getSkipReason = test => test && (getSkipReason(test.parent) || test.skipReason);
const getFilePath = test => (test && test.file) || (test.parent && getFilePath(test.parent));
const getRelativeFilePath = file => (file ? path.relative(process.cwd(), file) : undefined);

function toPrintableError(err) {
    if (!(err instanceof Error)) return err;

    const cause = err.cause instanceof Error ? toPrintableError(err.cause) : err.cause;

    const result = cause ? new Error(err.message, { cause }) : new Error(err.message);
    result.stack = err.stack;

    return result;
}

const getTestError = test => {
    let error = test.err ? util.inspect(toPrintableError(test.err)) : undefined;

    if (test.err && test.err.seleniumStack) {
        error = error.replace(/$/m, ` (${test.err.seleniumStack.orgStatusMessage})`);
    }

    return error;
};

exports.formatTestInfo = test => {
    const suiteName = test.fullTitle().replace(test.title, "");
    const sessionId = test.sessionId ? `:${test.sessionId}` : "";
    const reason = test.pending && ` reason: ${chalk.red(getSkipReason(test) || "no comment")}`;
    const pid = test.meta?.pid ? `, pid:${test.meta.pid}` : "";

    return (
        ` ${suiteName}${chalk.underline(test.title)} [${chalk.yellow(test.browserId)}` +
        `${sessionId}${pid}] - ${chalk.cyan(test.duration || 0)}ms${reason || ""}`
    );
};

exports.getTestInfo = test => {
    const file = getFilePath(test);
    const testInfo = {
        fullTitle: test.fullTitle(),
        browserId: test.browserId,
        file: getRelativeFilePath(file),
        sessionId: test.sessionId,
        duration: test.duration,
        startTime: test.startTime,
        meta: test.meta,
    };

    if (test.err) {
        testInfo.error = chalk.supportsColor ? getTestError(test) : stripAnsi(getTestError(test));
    }

    if (test.err && test.err.snippet) {
        testInfo.errorSnippet = chalk.supportsColor ? test.err.snippet : stripAnsi(test.err.snippet);
    }

    if (test.pending) {
        testInfo.reason = getSkipReason(test);
    }

    return testInfo;
};

exports.extendTestInfo = (test, opts) => {
    return _.extend(exports.getTestInfo(test), opts);
};

exports.formatFailedTests = tests => {
    const formattedTests = [];

    tests.forEach(test => {
        const testItem = _.pick(test, ["fullTitle", "file"]);

        if (_.find(formattedTests, testItem)) {
            return;
        }

        const browsers = _.filter(tests, testItem);
        formattedTests.push(_.extend(testItem, { browsers }));
    });

    return formattedTests;
};
