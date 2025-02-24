import { eventWithTime } from "@rrweb/types";
import { Callstack } from "./callstack";
import * as cmds from "./commands";
import { isGroup, normalizeCommandArgs, runWithHooks } from "./utils";
import { BrowserConfig } from "../../config/browser-config";
import { RecordMode } from "../../config/types";
import { TestStep, TestStepKey } from "../../types";
import { filterEvents, installRrwebAndCollectEvents, sendFilteredEvents } from "./rrweb";

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
        [TestStepKey.Name]: name,
        [TestStepKey.Args]: normalizeCommandArgs(name, args),
        [TestStepKey.Scope]: cmds.createScope(elementScope ?? false),
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

interface HooksData {
    session: WebdriverIO.Browser;
    callstack: Callstack;
    config: BrowserConfig;
}

interface RunWithHistoryHooksData<T> extends HooksData {
    nodeData: NodeData;
    fn: () => T;
}

export const runWithoutHistory = async <T>(
    { callstack }: { callstack: HooksData["callstack"] },
    fn: () => T,
): Promise<T> => {
    callstack.setIsInBypassMode(true);
    try {
        return await fn();
    } finally {
        callstack.setIsInBypassMode(false);
    }
};

const runWithHistoryHooks = <T>({ session, callstack, nodeData, fn, config }: RunWithHistoryHooksData<T>): T => {
    nodeData.key = nodeData.key ?? Symbol();

    if (callstack.isInBypassMode) {
        return fn();
    }

    return runWithHooks({
        before: async () => {
            const recordMode = config.record.mode;
            const isRetry = (session.executionContext?.ctx?.attempt ?? 0) > 0;
            const shouldRecord = recordMode !== RecordMode.Off && !(recordMode === RecordMode.OnForRetries && !isRetry);

            let rrwebEvents: eventWithTime[] = [];
            if (shouldRecord && process.send && session.executionContext) {
                rrwebEvents = await installRrwebAndCollectEvents(session, callstack);
            }

            const rrwebEventsFiltered = filterEvents(rrwebEvents);
            sendFilteredEvents(session, rrwebEventsFiltered);

            callstack.enter(mkHistoryNode(nodeData));
        },
        fn,
        after: () => callstack.leave(nodeData.key!),
        error: () => callstack.markError(shouldPropagateFn),
    });
};

const overwriteAddCommand = (session: WebdriverIO.Browser, callstack: Callstack, config: BrowserConfig): void => {
    session.overwriteCommand("addCommand", (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }

        function decoratedWrapper(this: WebdriverIO.Browser, ...args: unknown[]): unknown {
            return runWithHistoryHooks({
                session,
                callstack,
                nodeData: { name, args, elementScope, overwrite: false },
                fn: () => wrapper.apply(this, args),
                config,
            });
        }

        return origCommand(name, decoratedWrapper, elementScope);
    });
};

const overwriteOverwriteCommand = (session: WebdriverIO.Browser, callstack: Callstack, config: BrowserConfig): void => {
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
                session,
                callstack,
                nodeData: { name, args, elementScope, overwrite: true },
                fn: () => (wrapper as (...args: unknown[]) => unknown).apply(this, [origFn, ...args]),
                config,
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return origCommand(name, decoratedWrapper as any, elementScope);
    });
};

interface OverwriteCommandsData extends HooksData {
    commands: string[];
    elementScope: boolean;
}

const overwriteCommands = ({ session, callstack, commands, elementScope, config }: OverwriteCommandsData): void => {
    commands.forEach(name => {
        function decoratedWrapper(origFn: (...args: unknown[]) => unknown, ...args: unknown[]): unknown {
            return runWithHistoryHooks({
                session,
                callstack,
                nodeData: { name, args, elementScope, overwrite: false },
                fn: () => origFn(...args),
                config,
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.overwriteCommand(name as any, decoratedWrapper as any, elementScope as any);
    });
};

const overwriteBrowserCommands = (session: WebdriverIO.Browser, callstack: Callstack, config: BrowserConfig): void =>
    overwriteCommands({
        session,
        callstack,
        commands: cmds.getBrowserCommands().filter(cmd => !shouldNotWrapCommand(cmd)),
        elementScope: false,
        config,
    });

const overwriteElementCommands = (session: WebdriverIO.Browser, callstack: Callstack, config: BrowserConfig): void =>
    overwriteCommands({
        session,
        callstack,
        commands: cmds.getElementCommands(),
        elementScope: true,
        config,
    });

export const runGroup = <T>({ session, callstack, config }: HooksData, name: string, fn: () => T): T => {
    if (!callstack) {
        return fn();
    }

    return runWithHistoryHooks({
        session,
        callstack,
        nodeData: { name, args: [], isGroup: true },
        fn,
        config,
    });
};

const overwriteRunStepCommand = (session: WebdriverIO.Browser, callstack: Callstack, config: BrowserConfig): void => {
    session.overwriteCommand("runStep", (origCommand, stepName: string, stepCb) => {
        return runGroup({ session, callstack, config }, stepName, () => origCommand(stepName, stepCb));
    });
};

export const initCommandHistory = (session: WebdriverIO.Browser, config: BrowserConfig): Callstack => {
    const callstack = new Callstack();

    overwriteAddCommand(session, callstack, config);
    overwriteBrowserCommands(session, callstack, config);
    overwriteElementCommands(session, callstack, config);
    overwriteOverwriteCommand(session, callstack, config);
    overwriteRunStepCommand(session, callstack, config);

    return callstack;
};
