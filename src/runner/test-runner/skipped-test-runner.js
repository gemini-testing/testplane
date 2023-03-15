"use strict";

const Runner = require("../runner");
const Events = require("../../constants/runner-events");

module.exports = class SkippedTestRunner extends Runner {
    constructor(test) {
        super();

        this._test = test.clone();
    }

    run() {
        if (this._test.disabled || this._isSilentlySkipped(this._test)) {
            return;
        }

        this.emit(Events.TEST_BEGIN, this._test);
        this.emit(Events.TEST_PENDING, this._test);
        this.emit(Events.TEST_END, this._test);
    }

    _isSilentlySkipped({ silentSkip, parent }) {
        return silentSkip || (parent && this._isSilentlySkipped(parent));
    }
};
