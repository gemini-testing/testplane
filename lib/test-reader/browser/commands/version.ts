import BaseCommand from './command';

import type { Test } from '../../../types/mocha';

export default class VersionCommand extends BaseCommand {
    private _oneTimeHandler: null | ((test: Test) => void);
    private _globalHandler: null | ((test: Test) => void);

    constructor() {
        super();

        this._oneTimeHandler = null;
        this._globalHandler = null;
    }

    public execute(browserVersionToSet: string): void {
        this._oneTimeHandler = (test: Test) => {
            test.browserVersion = browserVersionToSet;
            test.hasBrowserVersionOverwritten = true;
        };
    }

    public handleTest(test: Test): void {
        const execute = this._oneTimeHandler || this._globalHandler;

        if (execute) {
            execute(test);
        }

        this._oneTimeHandler = null;
    }

    public handleSuite(): void {
        this._globalHandler = this._oneTimeHandler || this._globalHandler;
        this._oneTimeHandler = null;
    }
};
