"use strict";

const _ = require("lodash");
const { CommandHistoryKey } = require("../../types");

module.exports = class Callstack {
    constructor() {
        this._history = [];
        this._stack = [];
    }

    enter(data) {
        this._stack.push({
            ...data,
            [CommandHistoryKey.TimeStart]: Date.now(),
            [CommandHistoryKey.Children]: [],
        });
    }

    leave(key) {
        const currentNodeIndex = _.findLastIndex(this._stack, node => node[CommandHistoryKey.Key] === key);
        const wasRemovedByParent = currentNodeIndex === -1;

        if (wasRemovedByParent) {
            return;
        }

        const removedNodes = this._stack.splice(currentNodeIndex);
        const currentNode = _.first(removedNodes);
        const parentNode = _.last(this._stack);
        const isCurrentNodeRoot = this._stack.length === 0;

        currentNode[CommandHistoryKey.TimeEnd] = Date.now();
        currentNode[CommandHistoryKey.Duration] =
            currentNode[CommandHistoryKey.TimeEnd] - currentNode[CommandHistoryKey.TimeStart];

        isCurrentNodeRoot ? this._history.push(currentNode) : parentNode[CommandHistoryKey.Children].push(currentNode);
    }

    markError(shouldPropagateFn) {
        let parentNode = null;
        let currentNode = _.first(this._stack);
        let shouldContinue = Boolean(currentNode);

        while (shouldContinue) {
            currentNode[CommandHistoryKey.IsFailed] = true;

            parentNode = currentNode;
            currentNode = _.last(currentNode[CommandHistoryKey.Children]);
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
