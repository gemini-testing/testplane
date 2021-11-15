// TODO: refactor this file because it contains not only runner events

import _ from 'lodash';

enum RunnerEvents {
    INIT = 'init',

    RUNNER_START = 'startRunner',
    RUNNER_END = 'endRunner',

    SESSION_START = 'startSession',
    SESSION_END = 'endSession',

    EXIT = 'exit',

    NEW_WORKER_PROCESS = 'newWorkerProcess',

    SUITE_BEGIN = 'beginSuite',
    SUITE_END = 'endSuite',

    TEST_BEGIN = 'beginTest',
    TEST_END = 'endTest',

    TEST_PASS = 'passTest',
    TEST_FAIL = 'failTest',
    TEST_PENDING = 'pendingTest',

    RETRY = 'retry',

    CLI = 'cli',

    BEGIN = 'begin',
    END = 'end',

    BEFORE_FILE_READ = 'beforeFileRead',
    AFTER_FILE_READ = 'afterFileRead',

    AFTER_TESTS_READ = 'afterTestsRead',

    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'err'
}

export default RunnerEvents;

export const getAsyncEvents = () => _.pick(RunnerEvents, [
    'INIT',

    'RUNNER_START',
    'RUNNER_END',

    'SESSION_START',
    'SESSION_END',

    'EXIT',
]);

export const getRunnerSyncEvents = () => _.pick(RunnerEvents, [
    'NEW_WORKER_PROCESS',

    'SUITE_BEGIN',
    'SUITE_END',

    'TEST_BEGIN',
    'TEST_END',

    'TEST_PASS',
    'TEST_FAIL',
    'TEST_PENDING',

    'RETRY'
]);

export const getSyncEvents = () => _.extend({}, getRunnerSyncEvents(), _.pick(RunnerEvents, [
    'CLI',

    'BEGIN',
    'END',

    'BEFORE_FILE_READ',
    'AFTER_FILE_READ',

    'AFTER_TESTS_READ',

    'INFO',
    'WARNING',
    'ERROR'
]));
