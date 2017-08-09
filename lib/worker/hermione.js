'use strict';

const qUtils = require('qemitter/utils');

const RunnerEvents = require('./constants/runner-events');
const Runner = require('./runner');
const BaseHermione = require('../base-hermione');

module.exports = class Hermione extends BaseHermione {
    init(testFiles) {
        this._loadPlugins();

        this._runner = Runner.create(this._config);

        qUtils.passthroughEvent(this._runner, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,

            RunnerEvents.NEW_BROWSER
        ]);

        this._runner.init(testFiles);
    }

    runTest(fullTitle, options) {
        return this._runner.runTest(fullTitle, options);
    }
};
