import { Callstack } from "./callstack";
import * as cmds from "./commands";
import { runWithHooks, normalizeCommandArgs, isGroup } from "./utils";
import { TestStepKey, TestStep } from "../../types";

interface NodeData {
    name: string;
    args: unknown[];
    elementScope?: boolean;
    isGroup?: boolean;
    key?: symbol;
    overwrite?: boolean;
}

const shouldNotWrapCommand = (commandName: string): boolean =>
    ["addCommand", "overwriteCommand", "extendOptions", "setMeta", "getMeta", "runStep"].includes(commandName);

export const shouldPropagateFn = (parentNode: TestStep, currentNode: TestStep): boolean =>
    isGroup(parentNode) || isGroup(currentNode);

const mkHistoryNode = ({ name, args, elementScope, key, overwrite, isGroup }: NodeData): TestStep => {
    const map: Partial<TestStep> = {
        [TestStepKey.Name]: name!,
        [TestStepKey.Args]: normalizeCommandArgs(name!, args),
        [TestStepKey.Scope]: cmds.createScope(elementScope!),
        [TestStepKey.Key]: key ?? Symbol(),
    };

    if (overwrite) {
        map[TestStepKey.IsOverwritten] = Boolean(overwrite);
    }

    if (isGroup) {
        map[TestStepKey.IsGroup] = true;
    }

    return map as TestStep;
};

interface RunWithHistoryHooksData<T> {
    callstack: Callstack;
    nodeData: NodeData;
    fn: () => T;
}

const runWithHistoryHooks = <T>({ callstack, nodeData, fn }: RunWithHistoryHooksData<T>): T => {
    nodeData.key = nodeData.key ?? Symbol();

    return runWithHooks({
        before: () => callstack.enter(mkHistoryNode(nodeData)),
        fn,
        after: () => callstack.leave(nodeData.key!),
        error: () => callstack.markError(shouldPropagateFn),
    });
};

const overwriteAddCommand = (session: WebdriverIO.Browser, callstack: Callstack): void => {
    session.overwriteCommand("addCommand", (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }

        function decoratedWrapper(this: WebdriverIO.Browser, ...args: unknown[]): unknown {
            return runWithHistoryHooks({
                callstack,
                nodeData: { name, args, elementScope, overwrite: false },
                fn: () => wrapper.apply(this, args),
            });
        }

        return origCommand(name, decoratedWrapper, elementScope);
    });
};

const overwriteOverwriteCommand = (session: WebdriverIO.Browser, callstack: Callstack): void => {
    session.overwriteCommand("overwriteCommand", (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }

        function decoratedWrapper(
            this: WebdriverIO.Browser,
            origFn: (...args: unknown[]) => unknown,
            ...args: unknown[]
        ): unknown {
            return runWithHistoryHooks({
                callstack,
                nodeData: { name, args, elementScope, overwrite: true },
                fn: () => (wrapper as (...args: unknown[]) => unknown).apply(this, [origFn, ...args]),
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return origCommand(name, decoratedWrapper as any, elementScope);
    });
};

interface OverwriteCommandsData {
    session: WebdriverIO.Browser;
    callstack: Callstack;
    commands: string[];
    elementScope: boolean;
}

const overwriteCommands = ({ session, callstack, commands, elementScope }: OverwriteCommandsData): void => {
    commands.forEach(name => {
        function decoratedWrapper(origFn: (...args: unknown[]) => unknown, ...args: unknown[]): unknown {
            return runWithHistoryHooks({
                callstack,
                nodeData: { name, args, elementScope, overwrite: false },
                fn: () => origFn(...args),
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.overwriteCommand(name as any, decoratedWrapper as any, elementScope as any);
    });
};

const overwriteBrowserCommands = (session: WebdriverIO.Browser, callstack: Callstack): void =>
    overwriteCommands({
        session,
        callstack,
        commands: cmds.getBrowserCommands().filter(cmd => !shouldNotWrapCommand(cmd)),
        elementScope: false,
    });

const overwriteElementCommands = (session: WebdriverIO.Browser, callstack: Callstack): void =>
    overwriteCommands({
        session,
        callstack,
        commands: cmds.getElementCommands(),
        elementScope: true,
    });

export const runGroup = <T>(callstack: Callstack | null, name: string, fn: () => T): T => {
    if (!callstack) {
        return fn();
    }

    return runWithHistoryHooks({
        callstack,
        nodeData: { name, args: [], isGroup: true },
        fn,
    });
};

const overwriteRunStepCommand = (session: WebdriverIO.Browser, callstack: Callstack): void => {
    session.overwriteCommand("runStep", (origCommand, stepName: string, stepCb) => {
        return runGroup(callstack, stepName, () => origCommand(stepName, stepCb));
    });
};

export const initCommandHistory = (session: WebdriverIO.Browser): Callstack => {
    const callstack = new Callstack();

    overwriteAddCommand(session, callstack);
    overwriteBrowserCommands(session, callstack);
    overwriteElementCommands(session, callstack);
    overwriteOverwriteCommand(session, callstack);
    overwriteRunStepCommand(session, callstack);

    return callstack;
};
