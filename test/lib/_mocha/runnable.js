'use strict';

module.exports = class Runnable {
    constructor(parent, options) {
        options = options || {};

        this.type = options.type;
        this.title = options.title || 'some-runnable';
        this.fn = options.fn;
        this.parent = parent;
        this.ctx = parent && parent.ctx || {};
    }

    static create(parent, options) {
        return new this(parent, options);
    }

    fullTitle() {
        return `${this.parent.title} ${this.title}`.trim();
    }

    run() {
        return this.fn.call(this.ctx);
    }

    timeout(val) {
        if (val === undefined) {
            return this._timeout;
        }

        this._timeout = val;
    }
};
