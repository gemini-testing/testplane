'use strict';

const _ = require('lodash');

const getAsyncEvents = () => ({
    RUNNER_START: 'startRunner',
    RUNNER_END: 'endRunner',

    SESSION_START: 'startSession',
    SESSION_END: 'endSession',

    EXIT: 'exit'
});

const getSyncEvents = () => ({
    SUITE_BEGIN: 'beginSuite',
    SUITE_END: 'endSuite',

    SUITE_FAIL: 'failSuite',

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

let events = _.assign(getSyncEvents(), getAsyncEvents());

Object.defineProperty(events, 'getSync', {value: getSyncEvents, enumerable: false});
Object.defineProperty(events, 'getAsync', {value: getAsyncEvents, enumerable: false});

module.exports = events;
