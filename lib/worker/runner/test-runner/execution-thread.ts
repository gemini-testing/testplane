import Bluebird from 'bluebird';

import type OneTimeScreenshooter from './one-time-screenshooter';
import type { Test } from '../../../types/mocha';
import type Browser from '../../../browser/existing-browser';
import type { Browser as Session } from 'webdriverio';

type CreateExecutionThreadOpts = {
    test: Test;
    browser: Browser;
    hermioneCtx;
    screenshooter: OneTimeScreenshooter;
};

export default class ExecutionThread {
    private _hermioneCtx;
    private _screenshooter: OneTimeScreenshooter;
    private _ctx: {
        browser: Session<'async'>;
        currentTest: Test;
    };

    static create(opts: CreateExecutionThreadOpts): ExecutionThread {
        return new this(opts);
    }

    constructor({test, browser, hermioneCtx, screenshooter}: CreateExecutionThreadOpts) {
        this._hermioneCtx = hermioneCtx;
        this._screenshooter = screenshooter;
        this._ctx = {
            browser: browser.publicAPI,
            currentTest: test
        };
    }

    async run(runnable): Promise<void> {
        this._setExecutionContext(Object.assign(runnable, {
            hermioneCtx: this._hermioneCtx,
            ctx: this._ctx
        }));

        try {
            await this._call(runnable);
        } catch (err) {
            this._ctx.currentTest.err = this._ctx.currentTest.err || err as Error;

            throw err;
        } finally {
            this._setExecutionContext(null);
        }
    }

    private _call(runnable) {
        let fnPromise = Bluebird.method(runnable.fn).apply(this._ctx);

        if (runnable.timeout()) {
            const msg = `${runnable.type} '${runnable.fullTitle()}' timed out after ${runnable.timeout()} ms`;
            fnPromise = fnPromise.timeout(runnable.timeout(), msg);
        }

        return fnPromise.tapCatch((e) => this._screenshooter.extendWithPageScreenshot(e));
    }

    private _setExecutionContext(context): void {
        Object.getPrototypeOf(this._ctx.browser).executionContext = context;
    }
};
