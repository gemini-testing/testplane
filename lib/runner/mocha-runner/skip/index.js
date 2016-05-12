'use strict';

const _ = require('lodash');

module.exports = class Skip {
    constructor() {
        this.shouldSkip = false;
    }

    handleEntity(entity) {
        if (!this.shouldSkip) {
            return;
        }

        entity = _.extend(entity, {pending: true, skipReason: this.comment});
        this._resetInfo();
    }

    _resetInfo() {
        this.shouldSkip = false;
        this.comment = '';
    }
};
