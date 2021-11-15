import _ from 'lodash';
import { historyDataMap } from './utils';
import * as logger from '../../utils/logger';

import type { scopes } from './commands';

type OmitPartial<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

export type Node = {
    [historyDataMap.ARGS]: any;
    [historyDataMap.CHILDREN]: Array<StackNode>;
    [historyDataMap.DURATION]: number;
    [historyDataMap.IS_OVERWRITTEN]?: number;
    [historyDataMap.NAME]: string;
    [historyDataMap.SCOPE]: typeof scopes[keyof typeof scopes];
    [historyDataMap.TIME_START]: number;
    [historyDataMap.TIME_END]: number;
};

type StackNode = OmitPartial<Node, historyDataMap.TIME_START | historyDataMap.CHILDREN>;
type HistoryNode = OmitPartial<Node, historyDataMap.TIME_START | historyDataMap.CHILDREN | historyDataMap.TIME_END | historyDataMap.DURATION>

export default class Callstack {
    private _history: Array<HistoryNode>;
    private _stack: Array<StackNode>;

    constructor() {
        this._history = [];
        this._stack = [];
    }

    public enter(data: Partial<Node>): void {
        this._stack.push({
            ...data,
            [historyDataMap.TIME_START]: Date.now(),
            [historyDataMap.CHILDREN]: []}
        );
    }

    public leave(): void {
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
            : parentNode && parentNode[historyDataMap.CHILDREN].push(currentNode);
    }

    public flush(): Array<HistoryNode> {
        const history = this._history;

        this._stack = [];
        this._history = [];

        return history;
    }
};
