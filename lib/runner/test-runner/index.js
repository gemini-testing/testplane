'use strict';

const SkippedTestRunner = require('./skipped-test-runner');
const InsistantTestRunner = require('./insistant-test-runner');

exports.create = function(test, config, browserAgent) {
    return test.pending
        ? SkippedTestRunner.create(test)
        : InsistantTestRunner.create(test, config, browserAgent);
};
