"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithHooks = exports.isGroup = exports.normalizeCommandArgs = void 0;
const lodash_1 = __importDefault(require("lodash"));
const types_1 = require("../../types");
const MAX_STRING_LENGTH = 50;
const normalizeCommandArgs = (commandName, args = []) => {
    if (commandName === "execute") {
        return ["code"];
    }
    return args.map(arg => {
        if (typeof arg === "string") {
            return lodash_1.default.truncate(arg, { length: MAX_STRING_LENGTH });
        }
        if (lodash_1.default.isPlainObject(arg)) {
            return "obj";
        }
        return String(arg);
    });
};
exports.normalizeCommandArgs = normalizeCommandArgs;
const isPromise = (val) => typeof lodash_1.default.get(val, "then") === "function";
const isGroup = (node) => Boolean(node && node[types_1.TestStepKey.IsGroup]);
exports.isGroup = isGroup;
const runWithHooks = ({ fn, before, after, error }) => {
    let isReturnedValuePromise = false;
    before();
    try {
        const value = fn();
        if (isPromise(value)) {
            isReturnedValuePromise = true;
            return value
                .catch((err) => {
                error(err);
                throw err;
            })
                .finally(after)
                .then(() => value); // It's valid to convert Promise to T since value is already Promise here
        }
        return value;
    }
    catch (err) {
        if (!isReturnedValuePromise) {
            error(err);
        }
        throw err;
    }
    finally {
        if (!isReturnedValuePromise) {
            after();
        }
    }
};
exports.runWithHooks = runWithHooks;
//# sourceMappingURL=utils.js.map