"use strict";

const _ = require("lodash");
const { TestStepKey } = require("../../types");

module.exports = class Callstack {
    constructor() {
        this._history = [];
        this._stack = [];
    }

    enter(data) {
        this._stack.push({
            ...data,
            [TestStepKey.TimeStart]: Date.now(),
            [TestStepKey.Children]: [],
        });
    }

    leave(key) {
        const currentNodeIndex = _.findLastIndex(this._stack, node => node[TestStepKey.Key] === key);
        const wasRemovedByParent = currentNodeIndex === -1;

        if (wasRemovedByParent) {
            return;
        }

        const removedNodes = this._stack.splice(currentNodeIndex);
        const currentNode = _.first(removedNodes);
        const parentNode = _.last(this._stack);
        const isCurrentNodeRoot = this._stack.length === 0;

        currentNode[TestStepKey.TimeEnd] = Date.now();
        currentNode[TestStepKey.Duration] = currentNode[TestStepKey.TimeEnd] - currentNode[TestStepKey.TimeStart];

        isCurrentNodeRoot ? this._history.push(currentNode) : parentNode[TestStepKey.Children].push(currentNode);
    }

    markError(shouldPropagateFn) {
        let parentNode = null;
        let currentNode = _.first(this._stack);
        let shouldContinue = Boolean(currentNode);

        while (shouldContinue) {
            currentNode[TestStepKey.IsFailed] = true;

            parentNode = currentNode;
            currentNode = _.last(currentNode[TestStepKey.Children]);
            shouldContinue = currentNode && shouldPropagateFn(parentNode, currentNode);
        }
    }

    release() {
        const history = this._history;

        this._stack = [];
        this._history = [];

        return history;
    }
};
