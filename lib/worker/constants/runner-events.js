'use strict';

const MainProcessRunnerEvents = require('../../constants/runner-events');

module.exports = {
    BEFORE_FILE_READ: MainProcessRunnerEvents.BEFORE_FILE_READ,
    AFTER_FILE_READ: MainProcessRunnerEvents.AFTER_FILE_READ,

    TEST_FAIL: MainProcessRunnerEvents.TEST_FAIL,
    ERROR: MainProcessRunnerEvents.ERROR,

    NEW_BROWSER: 'newBrowser'
};
