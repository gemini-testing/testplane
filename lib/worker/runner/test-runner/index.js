'use strict';

const _ = require('lodash');
const HookRunner = require('./hook-runner');
const ExecutionThread = require('./execution-thread');
const OneTimeScreenshooter = require('./one-time-screenshooter');
const AssertViewError = require('../../../browser/commands/assert-view/errors/assert-view-error');

module.exports = class TestRunner {
    static create(...args) {
        return new this(...args);
    }

    constructor(test, config, browserAgent) {
        this._test = Object.create(test);
        this._config = config;
        this._browserAgent = browserAgent;
    }

    async run({sessionId}) {
        const test = this._test;
        const browser = await this._browserAgent.getBrowser(sessionId);

        const screenshooter = OneTimeScreenshooter.create(this._config, browser);

        const hermioneCtx = test.hermioneCtx ? _.cloneDeep(test.hermioneCtx) : {};
        const executionThread = ExecutionThread.create({test, browser, hermioneCtx, screenshooter});
        const hookRunner = HookRunner.create(test, executionThread);

        let error;

        try {
            await hookRunner.runBeforeEachHooks();
            await executionThread.run(test);
        } catch (e) {
            error = e;
        }

        try {
            await hookRunner.runAfterEachHooks();
        } catch (e) {
            error = error || e;
        }

        const assertViewResults = hermioneCtx.assertViewResults;
        if (assertViewResults && assertViewResults.hasFails()) {
            error = new AssertViewError();
        }

        hermioneCtx.assertViewResults = assertViewResults ? assertViewResults.toRawObject() : [];
        const {meta, changes} = browser;
        const results = {hermioneCtx, meta, changes};

        this._browserAgent.freeBrowser(browser);

        if (error) {
            throw Object.assign(error, results);
        } else {
            return results;
        }
    }
};
