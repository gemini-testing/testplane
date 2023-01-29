'use strict';

const eventsUtils = require('../events/utils');

const RunnerEvents = require('./constants/runner-events');
const Runner = require('./runner');
const BaseHermione = require('../base-hermione');

module.exports = class Hermione extends BaseHermione {
    constructor(configPath) {
        super(configPath);

        this._runner = Runner.create(this._config);

        eventsUtils.passthroughEvent(this._runner, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,

            RunnerEvents.AFTER_TESTS_READ,

            RunnerEvents.NEW_BROWSER,
            RunnerEvents.UPDATE_REFERENCE
        ]);
    }

    async init() {
        await this._init();

        if (!global.expect) {
            const {setOptions} = require('expect-webdriverio');
            setOptions(this._config.system.expectOpts);
        }
    }

    runTest(fullTitle, options) {
        return this._runner.runTest(fullTitle, options);
    }

    isWorker() {
        return true;
    }
};
