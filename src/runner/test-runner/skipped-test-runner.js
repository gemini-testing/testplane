"use strict";

const { RunnableEmitter } = require("../types");
const { MasterEvents } = require("../../events");

module.exports = class SkippedTestRunner extends RunnableEmitter {
    constructor(test) {
        super();

        this._test = test.clone();
    }

    run() {
        if (this._test.disabled || this._isSilentlySkipped(this._test)) {
            return;
        }

        this.emit(MasterEvents.TEST_BEGIN, this._test);
        this.emit(MasterEvents.TEST_PENDING, this._test);
        this.emit(MasterEvents.TEST_END, this._test);
    }

    _isSilentlySkipped({ silentSkip, parent }) {
        return silentSkip || (parent && this._isSilentlySkipped(parent));
    }
};
