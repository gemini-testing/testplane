'use strict';

module.exports = class Runnable {
    constructor(parent, options) {
        options = options || {};

        this.title = options.title || 'some-runnable';
        this.fn = options.fn;
        this.parent = parent;
        this.ctx = {};
    }

    static create(parent, options) {
        return new this(parent, options);
    }

    fullTitle() {
        return `${this.parent.title} ${this.title}`;
    }

    run() {
        return this.fn();
    }
};
