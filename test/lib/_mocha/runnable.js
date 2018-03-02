'use strict';

module.exports = class Runnable {
    constructor(parent, options) {
        options = options || {};

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

    enableTimeouts(val) {
        if (val === undefined) {
            return this._enableTimeouts;
        }

        this._enableTimeouts = val;
    }

    timeout(val) {
        if (val === undefined) {
            return this._timeout;
        }

        this.enableTimeouts(true);
        this._timeout = val;
    }
};
