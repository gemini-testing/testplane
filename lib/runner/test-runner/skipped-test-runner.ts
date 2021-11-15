import Runner from '../runner';
import Events from '../../constants/runner-events';

import type { Suite, Test } from '../../types/mocha';

export default class SkippedTestRunner extends Runner {
    private _test: Test;

    constructor(test: Test) {
        super();

        this._test = Object.create(test);
    }

    public run(): void {
        if (this._test.disabled || this._isSilentlySkipped(this._test)) {
            return;
        }

        this.emit(Events.TEST_BEGIN, this._test);
        this.emit(Events.TEST_PENDING, this._test);
        this.emit(Events.TEST_END, this._test);
    }

    private _isSilentlySkipped({silentSkip, parent}: Test | Suite): boolean {
        return silentSkip || parent && this._isSilentlySkipped(parent);
    }
};
