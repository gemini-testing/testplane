"use strict";

import _ from "lodash";
import debug from "debug";

/**
 * Set implementation which allows to get and put an object
 * there only limited amout of times. After limit is reached
 * attempt to put an object there causes the object to be finalized.
 */

export type LimitedUseSetOpts<T> = {
    useLimit: number;
    finalize: (value: T) => Promise<void>;
    formatItem: (value: T) => string;
};

class LimitedUseSet<T extends object = object> {
    _useCounts: WeakMap<T, number>;
    _useLimit: number;
    _finalize: (value: T) => Promise<void>;
    _formatItem: (value: T) => string;
    _objects: T[];
    log: debug.Debugger;
    constructor(opts: LimitedUseSetOpts<T>) {
        this._useCounts = new WeakMap();
        this._useLimit = opts.useLimit;
        this._finalize = opts.finalize;
        this._formatItem = opts.formatItem || _.identity;
        this._objects = [];

        this.log = debug("testplane:pool:limited-use-set");
    }

    push(value: T): Promise<void> {
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

    _isOverLimit(value: T): boolean {
        if (this._useLimit === 0) {
            return true;
        }

        return this._useCounts.has(value) && this._useCounts.get(value)! >= this._useLimit;
    }

    pop(): T | null {
        if (this._objects.length === 0) {
            return null;
        }

        const result = this._objects.pop()!;
        const useCount = this._useCounts.get(result) || 0;
        const formatedItem = this._formatItem(result);

        this.log(`popping ${formatedItem}`);
        this.log(`previous use count ${formatedItem}:${useCount}`);

        this._useCounts.set(result, useCount + 1);

        return result;
    }
}

export default LimitedUseSet;
