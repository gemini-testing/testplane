'use strict';
const _ = require('lodash');
const { historyDataMap } = require('./utils');
const logger = require('../../utils/logger');
module.exports = class Callstack {
    constructor() {
        this._history = [];
        this._stack = [];
    }
    enter(data) {
        this._stack.push({
            ...data,
            [historyDataMap.TIME_START]: Date.now(),
            [historyDataMap.CHILDREN]: []
        });
    }
    leave() {
        const currentNode = this._stack.pop();
        if (!currentNode) {
            logger.warn('The stack of executed commands is empty.');
            return;
        }
        const parentNode = _.last(this._stack);
        const isCurrentNodeRoot = this._stack.length === 0;
        currentNode[historyDataMap.TIME_END] = Date.now();
        currentNode[historyDataMap.DURATION] = currentNode[historyDataMap.TIME_END] - currentNode[historyDataMap.TIME_START];
        isCurrentNodeRoot
            ? this._history.push(currentNode)
            : parentNode[historyDataMap.CHILDREN].push(currentNode);
    }
    flush() {
        const history = this._history;
        this._stack = [];
        this._history = [];
        return history;
    }
};
