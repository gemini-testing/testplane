import _ from "lodash";
import { TestStepKey, TestStep } from "../../types";

export class Callstack {
    private _history: TestStep[];
    private _stack: TestStep[];

    constructor() {
        this._history = [];
        this._stack = [];
    }

    enter(data: Omit<TestStep, TestStepKey.TimeStart | TestStepKey.Children>): void {
        this._stack.push({
            ...data,
            [TestStepKey.TimeStart]: Date.now(),
            [TestStepKey.Children]: [],
        });
    }

    leave(key: symbol): void {
        const currentNodeIndex = _.findLastIndex(this._stack, node => node[TestStepKey.Key] === key);
        const wasRemovedByParent = currentNodeIndex === -1;

        if (wasRemovedByParent) {
            return;
        }

        const removedNodes = this._stack.splice(currentNodeIndex);
        const currentNode = _.first(removedNodes) as TestStep;
        const parentNode = _.last(this._stack) as TestStep | undefined;
        const isCurrentNodeRoot = this._stack.length === 0;

        currentNode[TestStepKey.TimeEnd] = Date.now();
        currentNode[TestStepKey.Duration] = currentNode[TestStepKey.TimeEnd] - currentNode[TestStepKey.TimeStart];

        if (isCurrentNodeRoot) {
            this._history.push(currentNode);
        } else {
            parentNode![TestStepKey.Children].push(currentNode);
        }
    }

    markError(shouldPropagateFn: (parentNode: TestStep, currentNode: TestStep) => boolean): void {
        let parentNode: TestStep | null = null;
        let currentNode: TestStep | undefined = _.first(this._stack);
        let shouldContinue = Boolean(currentNode);

        while (shouldContinue && currentNode) {
            currentNode[TestStepKey.IsFailed] = true;

            parentNode = currentNode;
            currentNode = _.last(currentNode[TestStepKey.Children]);
            shouldContinue = Boolean(currentNode && shouldPropagateFn(parentNode, currentNode));
        }
    }

    release(): TestStep[] {
        const history = this._history;

        this._stack = [];
        this._history = [];

        return history;
    }
}
