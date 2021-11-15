import { events } from 'gemini-core';

import RunnerEvents from './constants/runner-events';
import Runner from './runner';
import BaseHermione from '../base-hermione';

export default class Hermione extends BaseHermione {
    private _runner: Runner;

    constructor(configPath: string) {
        super(configPath);

        this._runner = Runner.create(this._config);

        events.utils.passthroughEvent(this._runner, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,

            RunnerEvents.AFTER_TESTS_READ,

            RunnerEvents.NEW_BROWSER,
            RunnerEvents.UPDATE_REFERENCE
        ]);
    }

    public init(): Promise<void> {
        return this._init();
    }

    public runTest(fullTitle: string, options: any) {
        return this._runner.runTest(fullTitle, options);
    }

    public isWorker(): true {
        return true;
    }
};
