import makeDebug from "debug";
import { Callstack } from "./callstack";
import * as cmds from "./commands";
import { isGroup, normalizeCommandArgs, runWithHooks, shouldRecordSnapshots } from "./utils";
import { BrowserConfig } from "../../config/browser-config";
import { TestStep, TestStepKey } from "../../types";
import { filterEvents, installRrwebAndCollectEvents, sendFilteredEvents } from "./rrweb";
import { getContext, runWithContext } from "./async-local-storage";

const debug = makeDebug("testplane:browser:history");

interface NodeData {
    name: string;
    args: unknown[];
    elementScope?: boolean;
    isGroup?: boolean;
    key?: symbol;
    overwrite?: boolean;
}

export interface PromiseRef<T = unknown> {
    current: Promise<T>;
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
    snapshotsPromiseRef: PromiseRef;
    callstack: Callstack;
    config: BrowserConfig;
}

interface RunWithHistoryHooksData<T> extends HooksData {
    nodeData: NodeData;
    fn: () => T;
}

export const runWithoutHistory = async <T>(_: unknown, fn: () => T): Promise<T> => {
    return runWithContext({ shouldBypassHistory: true }, fn) as T;
};

const runWithHistoryHooks = <T>({
    session,
    callstack,
    snapshotsPromiseRef,
    nodeData,
    fn,
    config,
}: RunWithHistoryHooksData<T>): T => {
    nodeData.key = nodeData.key ?? Symbol();

    if (getContext()?.shouldBypassHistory) {
        return fn();
    }

    return runWithHooks({
        before: () => {
            callstack.enter(mkHistoryNode(nodeData));
        },
        fn: () => {
            const result = fn();

            if (typeof (result as Promise<unknown> | undefined)?.then === "function") {
                try {
                    const timeTravelMode = config.timeTravel.mode;
                    const isRetry = (session.executionContext?.ctx?.attempt ?? 0) > 0;
                    const shouldRecord = shouldRecordSnapshots(timeTravelMode, isRetry);
                    const isInterestingStep =
                        !nodeData.name.startsWith("is") &&
                        !nodeData.name.startsWith("get") &&
                        !nodeData.name.startsWith("$") &&
                        !nodeData.name.startsWith("wait");

                    if (
                        shouldRecord &&
                        process.send &&
                        session.executionContext?.ctx?.currentTest &&
                        isInterestingStep
                    ) {
                        const rrwebPromise = installRrwebAndCollectEvents(session, callstack)
                            ?.then(rrwebEvents => {
                                const rrwebEventsFiltered = filterEvents(rrwebEvents);
                                sendFilteredEvents(session, rrwebEventsFiltered);
                            })
                            .catch(e => {
                                debug("An error occurred during capturing snapshots in browser: %O", e);
                            });
                        snapshotsPromiseRef.current = snapshotsPromiseRef.current.then(() => rrwebPromise);
                    }
                } catch (e) {
                    debug("An error occurred during capturing snapshots in browser: %O", e);
                }
            }

            return result;
        },
        after: () => {
            return callstack.leave(nodeData.key!);
        },
        error: () => callstack.markError(shouldPropagateFn),
    });
};

const overwriteAddCommand = (
    session: WebdriverIO.Browser,
    callstack: Callstack,
    snapshotsPromiseRef: PromiseRef,
    config: BrowserConfig,
): void => {
    session.overwriteCommand("addCommand", (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }

        function decoratedWrapper(this: WebdriverIO.Browser, ...args: unknown[]): unknown {
            return runWithHistoryHooks({
                session,
                callstack,
                snapshotsPromiseRef,
                nodeData: { name, args, elementScope, overwrite: false },
                fn: () => wrapper.apply(this, args),
                config,
            });
        }

        return origCommand(name, decoratedWrapper, elementScope);
    });
};

const overwriteOverwriteCommand = (
    session: WebdriverIO.Browser,
    callstack: Callstack,
    snapshotsPromiseRef: PromiseRef,
    config: BrowserConfig,
): void => {
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
                snapshotsPromiseRef,
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

const overwriteCommands = ({
    session,
    snapshotsPromiseRef,
    callstack,
    commands,
    elementScope,
    config,
}: OverwriteCommandsData): void => {
    commands.forEach(name => {
        function decoratedWrapper(origFn: (...args: unknown[]) => unknown, ...args: unknown[]): unknown {
            return runWithHistoryHooks({
                session,
                snapshotsPromiseRef,
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

const overwriteBrowserCommands = (
    session: WebdriverIO.Browser,
    callstack: Callstack,
    snapshotsPromiseRef: PromiseRef,
    config: BrowserConfig,
): void =>
    overwriteCommands({
        session,
        callstack,
        snapshotsPromiseRef,
        commands: cmds.getBrowserCommands().filter(cmd => !shouldNotWrapCommand(cmd)),
        elementScope: false,
        config,
    });

const overwriteElementCommands = (
    session: WebdriverIO.Browser,
    callstack: Callstack,
    snapshotsPromiseRef: PromiseRef,
    config: BrowserConfig,
): void =>
    overwriteCommands({
        session,
        callstack,
        snapshotsPromiseRef,
        commands: cmds.getElementCommands(),
        elementScope: true,
        config,
    });

export const runGroup = <T>(
    { session, callstack, snapshotsPromiseRef, config }: HooksData,
    name: string,
    fn: () => T,
): T => {
    if (!callstack) {
        return fn();
    }

    return runWithHistoryHooks({
        session,
        callstack,
        snapshotsPromiseRef,
        nodeData: { name, args: [], isGroup: true },
        fn,
        config,
    });
};

const overwriteRunStepCommand = (
    session: WebdriverIO.Browser,
    callstack: Callstack,
    snapshotsPromiseRef: PromiseRef,
    config: BrowserConfig,
): void => {
    session.overwriteCommand("runStep", (origCommand, stepName: string, stepCb) => {
        return runGroup({ session, snapshotsPromiseRef, callstack, config }, stepName, () =>
            origCommand(stepName, stepCb),
        );
    });
};

interface InitHistoryResult {
    callstack: Callstack;
    snapshotsPromiseRef: PromiseRef;
}

export const initCommandHistory = (session: WebdriverIO.Browser, config: BrowserConfig): InitHistoryResult => {
    const callstack = new Callstack();
    const snapshotsPromiseRef: PromiseRef = { current: Promise.resolve() };

    overwriteAddCommand(session, callstack, snapshotsPromiseRef, config);
    overwriteBrowserCommands(session, callstack, snapshotsPromiseRef, config);
    overwriteElementCommands(session, callstack, snapshotsPromiseRef, config);
    overwriteOverwriteCommand(session, callstack, snapshotsPromiseRef, config);
    overwriteRunStepCommand(session, callstack, snapshotsPromiseRef, config);

    return { callstack, snapshotsPromiseRef };
};
