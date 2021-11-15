import _ from 'lodash';

import HookRunner from './hook-runner';
import ExecutionThread from './execution-thread';
import OneTimeScreenshooter from './one-time-screenshooter';
import AssertViewError from '../../../browser/commands/assert-view/errors/assert-view-error';

import type BrowserAgent from '../browser-agent';
import type Config from '../../../config';
import type{ Test } from '../../../types/mocha';

export default class TestRunner {
    private _test: Test;
    private _config: Config;
    private _browserAgent: BrowserAgent;

    public static create(test: Test, config: Config, browserAgent: BrowserAgent): TestRunner {
        return new this(test, config, browserAgent);
    }

    constructor(test: Test, config: Config, browserAgent: BrowserAgent) {
        this._test = _.cloneDeepWith(test, (val, key) => {
            // Don't clone whole tree
            if (key === 'parent') {
                return val;
            }
        });

        this._config = config;
        this._browserAgent = browserAgent;
    }

    public async run({sessionId, sessionCaps, sessionOpts}): Promise<void> {
        const test = this._test;
        const hermioneCtx = test.hermioneCtx || {};

        let browser;

        try {
            browser = await this._browserAgent.getBrowser({sessionId, sessionCaps, sessionOpts});
        } catch (e) {
            throw Object.assign(e, {hermioneCtx});
        }

        const screenshooter = OneTimeScreenshooter.create(this._config, browser);
        const executionThread = ExecutionThread.create({test, browser, hermioneCtx, screenshooter});
        const hookRunner = HookRunner.create(test, executionThread);

        let error;

        try {
            // TODO: make it on browser.init when "actions" method will be implemented in all webdrivers
            if (browser.config.resetCursor) {
                await this._resetCursorPosition(browser);
            }

            await hookRunner.runBeforeEachHooks();
            await executionThread.run(test);
        } catch (e) {
            error = e;
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
        if (!error && assertViewResults && assertViewResults.hasFails()) {
            error = new AssertViewError();
        }

        hermioneCtx.assertViewResults = assertViewResults ? assertViewResults.toRawObject() : [];
        const {meta} = browser;
        const results = {
            hermioneCtx,
            meta,
            history: browser.flushHistory()
        };

        this._browserAgent.freeBrowser(browser);

        if (error) {
            throw Object.assign(error, results);
        } else {
            return results;
        }
    }

    async _resetCursorPosition({publicAPI: session}) {
        const body = await session.$('body');
        if (!body) {
            throw new Error('There is no "body" element on the page when resetting cursor position');
        }

        await body.scrollIntoView();
        await body.moveTo({xOffset: 0, yOffset: 0});
    }
};

function isSessionBroken(error, {system: {patternsOnReject}}) {
    return error && patternsOnReject.some((p) => new RegExp(p).test(error.message));
}
