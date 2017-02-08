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
            this._rmFromTree(entity);
        } else {
            _.extend(entity, {pending: true, skipReason: this.comment});
        }

        this._resetInfo();
    }

    _rmFromTree(entity) {
        entity.type === 'test'
            ? entity.parent.tests.pop()
            : entity.parent.suites.pop();
    }

    _resetInfo() {
        this.shouldSkip = false;
        this.silent = false;
        this.comment = '';
    }
};
