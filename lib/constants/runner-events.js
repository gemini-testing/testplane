'use strict';

module.exports = {
    RUNNER_START: 'startRunner',
    RUNNER_END: 'endRunner',

    BROWSER_START: 'startBrowser',
    BROWSER_END: 'stopBrowser',

    SUITE_BEGIN: 'beginSuite',
    SUITE_END: 'endSuite',

    TEST_BEGIN: 'beginTest',
    TEST_END: 'endTest',

    TEST_PASS: 'passTest',
    TEST_FAIL: 'failTest',
    TEST_PENDING: 'pendingTest',

    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'err'
};
