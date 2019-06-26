// TODO: refactor this file because it contains not only runner events
'use strict';

const _ = require('lodash');

const getAsyncEvents = () => ({
    INIT: 'init',

    RUNNER_START: 'startRunner',
    RUNNER_END: 'endRunner',

    SESSION_START: 'startSession',
    SESSION_END: 'endSession',

    EXIT: 'exit'
});

const getRunnerSyncEvents = () => ({
    NEW_WORKER_PROCESS: 'newWorkerProcess',

    SUITE_BEGIN: 'beginSuite',
    SUITE_END: 'endSuite',

    TEST_BEGIN: 'beginTest',
    TEST_END: 'endTest',

    TEST_PASS: 'passTest',
    TEST_FAIL: 'failTest',
    TEST_PENDING: 'pendingTest',

    RETRY: 'retry'
});

const getSyncEvents = () => _.extend({}, getRunnerSyncEvents(), {
    CLI: 'cli',

    BEGIN: 'begin',
    END: 'end',

    BEFORE_FILE_READ: 'beforeFileRead',
    AFTER_FILE_READ: 'afterFileRead',

    AFTER_TESTS_READ: 'afterTestsRead',

    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'err'
});

let events = _.extend(getSyncEvents(), getAsyncEvents());

Object.defineProperty(events, 'getSync', {value: getSyncEvents, enumerable: false});
Object.defineProperty(events, 'getAsync', {value: getAsyncEvents, enumerable: false});
Object.defineProperty(events, 'getRunnerSync', {value: getRunnerSyncEvents, enumerable: false});

module.exports = events;
