import _ from 'lodash';
import * as validators from '../validators';
import * as env from '../utils/env';

import type Config from '../config';
import type { Suite } from '../types/mocha';

export default class TestSkipper {
    private _skipBrowsers: Array<string>;

    public static create(config: Config): TestSkipper {
        return new TestSkipper(config);
    }

    public static _validateUnknownBrowsers(skipBrowsers: Array<string>, browsers: Array<string>): void {
        validators.validateUnknownBrowsers(skipBrowsers, browsers);
    }

    constructor(config: Config) {
        this._skipBrowsers = env.parseCommaSeparatedValue('HERMIONE_SKIP_BROWSERS');

        TestSkipper._validateUnknownBrowsers(this._skipBrowsers, this._getBrowsersFromConfig(config));
    }

    public applySkip(suite: Suite, browserId: string): void {
        if (this._shouldBeSkipped(browserId)) {
            suite.pending = true;
            suite.skipReason = 'The test was skipped by environment variable HERMIONE_SKIP_BROWSERS';
        }
    }

    private _shouldBeSkipped(browserId: string): boolean {
        return _.includes(this._skipBrowsers, browserId);
    }

    private _getBrowsersFromConfig(config: Config): Array<string> {
        return _.keys(config.browsers);
    }
};
