"use strict";
const _ = require("lodash");
const debug = require("debug");
/**
 * Set implementation which allows to get and put an object
 * there only limited amout of times. After limit is reached
 * attempt to put an object there causes the object to be finalized.
 *
 * @constructor
 * @param {Number} useLimit number of times object can be popped from set
 * before finalizing.
 * @param {Function} finalize callback which will be called when value in
 * set needs to be finalized.
 */
module.exports = class LimitedUseSet {
    constructor(opts) {
        this._useCounts = new WeakMap();
        this._useLimit = opts.useLimit;
        this._finalize = opts.finalize;
        this._formatItem = opts.formatItem || _.identity;
        this._objects = [];
        this.log = debug("hermione:pool:limited-use-set");
    }
    push(value) {
        const formatedItem = this._formatItem(value);
        this.log(`push ${formatedItem}`);
        if (this._isOverLimit(value)) {
            this.log(`over limit, finalizing ${formatedItem}`);
            return this._finalize(value);
        }
        this.log(`under limit for ${formatedItem}`);
        this._objects.push(value);
        return Promise.resolve();
    }
    _isOverLimit(value) {
        if (this._useLimit === 0) {
            return true;
        }
        return this._useCounts.has(value) && this._useCounts.get(value) >= this._useLimit;
    }
    pop() {
        if (this._objects.length === 0) {
            return null;
        }
        const result = this._objects.pop();
        const useCount = this._useCounts.get(result) || 0;
        const formatedItem = this._formatItem(result);
        this.log(`popping ${formatedItem}`);
        this.log(`previous use count ${formatedItem}:${useCount}`);
        this._useCounts.set(result, useCount + 1);
        return result;
    }
};
//# sourceMappingURL=limited-use-set.js.map