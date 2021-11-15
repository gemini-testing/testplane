import { EventEmitter } from 'events';
import Events from '../constants/runner-events';

import type { Suite, Test } from '../types/mocha';

type SuiteInfo = {
    runningTests: number;
    retries: number;
};

export default class SuiteMonitor extends EventEmitter {
    private _suites: Map<Suite, SuiteInfo>;
    
    public static create(): SuiteMonitor {
        return new SuiteMonitor();
    }

    constructor() {
        super();

        this._suites = new Map();
    }

    public testBegin(test: Test): void {
        this._addTest(test.parent as Suite);
    }

    private _addTest(suite: Suite): void {
        if (suite.root) {
            return;
        }

        this._addTest(suite.parent as Suite);

        if (!this._suites.has(suite)) {
            this.emit(Events.SUITE_BEGIN, suite);
            this._suites.set(suite, {runningTests: 1, retries: 0});
        } else {
            const suiteInfo = this._suites.get(suite) as SuiteInfo;
            ++suiteInfo.runningTests;
            if (suiteInfo.retries > 0) {
                --suiteInfo.retries;
            }
        }
    }

    public testEnd(test: Test): void {
        this._rmTest(test.parent as Suite);
    }

    private _rmTest(suite: Suite): void {
        if (suite.root) {
            return;
        }

        const suiteInfo = this._suites.get(suite) as SuiteInfo;
        if (--suiteInfo.runningTests === 0 && suiteInfo.retries === 0) {
            this._suites.delete(suite);
            this.emit(Events.SUITE_END, suite);
        }

        this._rmTest(suite.parent as Suite);
    }

    public testRetry(test: Test): void {
        this._addRetry(test.parent as Suite);
    }

    private _addRetry(suite: Suite): void {
        if (suite.root) {
            return;
        }

        ++(this._suites.get(suite) as SuiteInfo).retries;

        this._addRetry(suite.parent as Suite);
    }
};
