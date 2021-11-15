import Bluebird from 'bluebird';

import type ExecutionThread from './execution-thread';
import type { Hook, Suite, Test } from '../../../types/mocha';

export default class HookRunner {
    private _test: Test;
    private _executionThread: ExecutionThread;
    private _failedSuite: Suite | null;

    public static create(test: Test, executionThread: ExecutionThread): HookRunner {
        return new this(test, executionThread);
    }

    constructor(test: Test, executionThread: ExecutionThread) {
        this._test = test;
        this._executionThread = executionThread;

        this._failedSuite = null;
    }

    public async runBeforeEachHooks(): Promise<void> {
        await this._runBeforeEachHooks(this._test.parent);
    }

    public async _runBeforeEachHooks(suite: Suite): Promise<void> {
        if (suite.parent) {
            await this._runBeforeEachHooks(suite.parent);
        }

        try {
            //@ts-ignore access private field
            await Bluebird.mapSeries(suite._beforeEach, (hook: Hook) => this._runHook(hook));
        } catch (e) {
            this._failedSuite = suite;
            throw e;
        }
    }

    private async _runHook(hook: Hook): Promise<void> {
        return this._executionThread.run(Object.create(hook));
    }

    async runAfterEachHooks(): Promise<void> {
        await this._runAfterEachHooks(this._failedSuite || this._test.parent);
    }

    async _runAfterEachHooks(suite: Suite): Promise<void> {
        let error: Error | undefined;

        try {
            //@ts-ignore access private field
            await Bluebird.mapSeries(suite._afterEach, (hook: Hook) => this._runHook(hook));
        } catch (e) {
            error = e as Error;
        }

        if (suite.parent) {
            try {
                await this._runAfterEachHooks(suite.parent);
            } catch (e) {
                error = error || e as Error;
            }
        }

        if (error) {
            throw error;
        }
    }
};
