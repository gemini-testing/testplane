'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const HookRunner = require('./hook-runner');
const ExecutionThread = require('./execution-thread');
const OneTimeScreenshooter = require('./one-time-screenshooter');
const AssertViewError = require('../../../browser/commands/assert-view/errors/assert-view-error');

module.exports = class TestRunner {
    static create(...args) {
        return new this(...args);
    }

    constructor(test, config, browserAgent) {
        this._test = _.cloneDeepWith(test, (val, key) => {
            // Don't clone whole tree
            if (key === 'parent') {
                return val;
            }
        });

        this._config = config;
        this._browserAgent = browserAgent;
    }

    async run({sessionId}) {
        const test = this._test;
        const browser = await this._browserAgent.getBrowser(sessionId);

        const screenshooter = OneTimeScreenshooter.create(this._config, browser);

        const hermioneCtx = test.hermioneCtx || {};

        const executionThread = ExecutionThread.create({test, browser, hermioneCtx, screenshooter});
        const hookRunner = HookRunner.create(test, executionThread);

        // TODO: make it on browser.init when "actions" method will be implemented in all webdrivers
        if (browser.config.resetCursor) {
            await this._resetCursorPosition(browser);
        }

        let error;

        try {
            await hookRunner.runBeforeEachHooks();
            await executionThread.run(test);
        } catch (e) {
            error = e;
            test.err = error;
        }

        if (isSessionBroken(error, this._config)) {
            browser.markAsBroken();
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
        const {meta, state: browserState} = browser;
        const results = {hermioneCtx, meta, browserState};

        this._browserAgent.freeBrowser(browser);

        if (error) {
            throw Object.assign(error, results);
        } else {
            return results;
        }
    }

    async _resetCursorPosition({publicAPI: session}) {
        const baseDeprecationWarnings = session.options.deprecationWarnings;
        session.options.deprecationWarnings = false;

        await Promise.resolve(session.scroll('body', 0, 0))
            .then(() => session.moveToObject('body', 0, 0))
            .finally(() => session.options.deprecationWarnings = baseDeprecationWarnings);
    }
};

function isSessionBroken(error, {system: {patternsOnReject}}) {
    return error && patternsOnReject.some((p) => new RegExp(p).test(error.message));
}
