import path from "node:path";
import chalk from "chalk";
import _ from "lodash";

const getSkipReason = test => test && (getSkipReason(test.parent) || test.skipReason);
const getFilePath = test => (test && test.file) || (test.parent && getFilePath(test.parent));
const getRelativeFilePath = file => (file ? path.relative(process.cwd(), file) : undefined);

const getTestError = test => {
    let error = test.err ? test.err.stack || test.err.message || test.err : undefined;

    if (test.err && test.err.seleniumStack) {
        error = error.replace(/$/m, ` (${test.err.seleniumStack.orgStatusMessage})`);
    }

    return error;
};

export const formatTestInfo = test => {
    const suiteName = test.fullTitle().replace(test.title, "");
    const sessionId = test.sessionId ? `:${test.sessionId}` : "";
    const reason = test.pending && ` reason: ${chalk.red(getSkipReason(test) || "no comment")}`;

    return (
        ` ${suiteName}${chalk.underline(test.title)} [${chalk.yellow(test.browserId)}` +
        `${sessionId}] - ${chalk.cyan(test.duration || 0)}ms${reason || ""}`
    );
};

export const getTestInfo = test => {
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
        testInfo.error = getTestError(test);
    }

    if (test.pending) {
        testInfo.reason = getSkipReason(test);
    }

    return testInfo;
};

export const extendTestInfo = (test, opts) => {
    return _.extend(getTestInfo(test), opts);
};

export const formatFailedTests = tests => {
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
