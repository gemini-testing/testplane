"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimitedUseSet = void 0;
const lodash_1 = __importDefault(require("lodash"));
const debug_1 = __importDefault(require("debug"));
class LimitedUseSet {
    constructor(opts) {
        this._useCounts = new WeakMap();
        this._useLimit = opts.useLimit;
        this._finalize = opts.finalize;
        this._formatItem = opts.formatItem || lodash_1.default.identity;
        this._objects = [];
        this.log = (0, debug_1.default)("testplane:pool:limited-use-set");
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
}
exports.LimitedUseSet = LimitedUseSet;
//# sourceMappingURL=limited-use-set.js.map