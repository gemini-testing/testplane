"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Callstack = void 0;
const lodash_1 = __importDefault(require("lodash"));
const types_1 = require("../../types");
class Callstack {
    constructor() {
        this._history = [];
        this._stack = [];
    }
    enter(data) {
        this._stack.push({
            ...data,
            [types_1.TestStepKey.TimeStart]: Date.now(),
            [types_1.TestStepKey.Children]: [],
        });
    }
    leave(key) {
        const currentNodeIndex = lodash_1.default.findLastIndex(this._stack, node => node[types_1.TestStepKey.Key] === key);
        const wasRemovedByParent = currentNodeIndex === -1;
        if (wasRemovedByParent) {
            return;
        }
        const removedNodes = this._stack.splice(currentNodeIndex);
        const currentNode = lodash_1.default.first(removedNodes);
        const parentNode = lodash_1.default.last(this._stack);
        const isCurrentNodeRoot = this._stack.length === 0;
        currentNode[types_1.TestStepKey.TimeEnd] = Date.now();
        currentNode[types_1.TestStepKey.Duration] = currentNode[types_1.TestStepKey.TimeEnd] - currentNode[types_1.TestStepKey.TimeStart];
        if (isCurrentNodeRoot) {
            this._history.push(currentNode);
        }
        else {
            parentNode[types_1.TestStepKey.Children].push(currentNode);
        }
    }
    markError(shouldPropagateFn) {
        let parentNode = null;
        let currentNode = lodash_1.default.first(this._stack);
        let shouldContinue = Boolean(currentNode);
        while (shouldContinue && currentNode) {
            currentNode[types_1.TestStepKey.IsFailed] = true;
            parentNode = currentNode;
            currentNode = lodash_1.default.last(currentNode[types_1.TestStepKey.Children]);
            shouldContinue = Boolean(currentNode && shouldPropagateFn(parentNode, currentNode));
        }
    }
    release() {
        const history = this._history;
        this._stack = [];
        this._history = [];
        return history;
    }
}
exports.Callstack = Callstack;
//# sourceMappingURL=callstack.js.map