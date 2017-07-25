'use strict';

const _ = require('lodash');

const getAsyncEvents = () => ({
    RUNNER_START: 'startRunner',
    RUNNER_END: 'endRunner',

    SESSION_START: 'startSession',
    SESSION_END: 'endSession',

    BEGIN: 'begin',

    EXIT: 'exit'
});

const getSyncEvents = () => ({
    BEFORE_FILE_READ: 'beforeFileRead',
    AFTER_FILE_READ: 'afterFileRead',

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

const getEvents = () => _.merge(getAsyncEvents(), getSyncEvents());

let events = _.extend(getSyncEvents(), getAsyncEvents());

Object.defineProperty(events, 'getSync', {value: getSyncEvents, enumerable: false});
Object.defineProperty(events, 'getAsync', {value: getAsyncEvents, enumerable: false});
Object.defineProperty(events, 'get', {value: getEvents, enumerable: false});

module.exports = events;
