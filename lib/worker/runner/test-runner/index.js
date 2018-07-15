'use strict';

const HookRunner = require('./hook-runner');
const ExecutionThread = require('./execution-thread');
const OneTimeScreenshooter = require('./one-time-screenshooter');

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

        const hermioneCtx = {};
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

        hermioneCtx.assertViewResults = hermioneCtx.assertViewResults
            ? hermioneCtx.assertViewResults.toRawObject()
            : [];
        const {meta, changes} = browser;
        const results = {hermioneCtx, meta, changes};

        if (error) {
            throw Object.assign(error, results);
        } else {
            return results;
        }
    }
};
