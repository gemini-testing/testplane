'use strict';

const _ = require('lodash');

const common = {
    BEFORE_FILE_READ: 'beforeFileRead',
    AFTER_FILE_READ: 'afterFileRead'
};

const getAsyncEvents = () => ({
    RUNNER_START: 'startRunner',
    RUNNER_END: 'endRunner',

    SESSION_START: 'startSession',
    SESSION_END: 'endSession',

    BEGIN: 'begin',

    EXIT: 'exit'
});

const getSyncEvents = () => _.extend({}, common, {
    SUITE_BEGIN: 'beginSuite',
    SUITE_END: 'endSuite',

    TEST_BEGIN: 'beginTest',
    TEST_END: 'endTest',

    TEST_PASS: 'passTest',
    TEST_FAIL: 'failTest',
    TEST_PENDING: 'pendingTest',

    RETRY: 'retry',

    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'err'
});

const getSubprocessEvents = () => _.extend({}, common, {
    NEW_BROWSER: 'newBrowser'
});

let events = _.extend(getSyncEvents(), getAsyncEvents(), getSubprocessEvents());

Object.defineProperty(events, 'getSync', {value: getSyncEvents, enumerable: false});
Object.defineProperty(events, 'getAsync', {value: getAsyncEvents, enumerable: false});

Object.defineProperty(events, 'subprocess', {value: getSubprocessEvents, enumerable: false});

module.exports = events;
