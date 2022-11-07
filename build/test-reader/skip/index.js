'use strict';
const _ = require('lodash');
module.exports = class Skip {
    constructor() {
        this.shouldSkip = false;
        this.silent = false;
    }
    handleEntity(entity) {
        if (!this.shouldSkip) {
            return;
        }
        if (this.silent) {
            _.extend(entity, { pending: true, silentSkip: true });
        }
        else {
            _.extend(entity, { pending: true, skipReason: this.comment });
        }
        this._resetInfo();
    }
    _resetInfo() {
        this.shouldSkip = false;
        this.silent = false;
        this.comment = '';
    }
};
