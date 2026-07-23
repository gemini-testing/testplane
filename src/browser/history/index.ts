import path from "node:path";
import makeDebug from "debug";
import ErrorStackParser from "error-stack-parser";
import { Callstack } from "./callstack";
import * as cmds from "./commands";
import { isGroup, normalizeCommandArgs, runWithHooks, shouldRecordSnapshots } from "./utils";
import { BrowserConfig } from "../../config/browser-config";
import { TestStepKey } from "../../types";
import type { Test, TestStep } from "../../types";
import { cleanupRrweb, filterEvents, installRrwebAndCollectEvents, sendFilteredEvents } from "./rrweb";
import { getHistoryContext, runWithHistoryContext } from "./async-local-storage";
import { noopProfilerRuntime } from "../../profiler/runtime/noop";
import type { ProfilerRuntimeLike } from "../../profiler/runtime/types";
import type { SourceRef } from "../../profiler/schema";
import { ProfilerSanitizer } from "../../profiler/sanitize";
import { softFileURLToPath } from "../../utils/fs";
import { SAVE_HISTORY_MODE } from "../../constants/config";

const debug = makeDebug("testplane:browser:history");
const debugTimeTravel = makeDebug("testplane:time-travel:history");
const packageOrBuildRoot = path.resolve(__dirname, "../../..");
const testplaneRoot =
    path.basename(packageOrBuildRoot) === "build" ? path.dirname(packageOrBuildRoot) : packageOrBuildRoot;
const commandWrapperDirectories = [
    "src/browser/history/",
    "src/browser/stacktrace/",
    "build/src/browser/history/",
    "build/src/browser/stacktrace/",
];
let profilerSanitizer: ProfilerSanitizer | undefined;

interface NodeData {
    name: string;
    args: unknown[];
    elementScope?: boolean;
    isGroup?: boolean;
    key?: symbol;
    custom?: boolean;
    overwrite?: boolean;
    source?: SourceRef;
}

export interface PromiseRef<T = unknown> {
    current: Promise<T>;
}

const shouldNotWrapCommand = (commandName: string): boolean =>
    ["addCommand", "overwriteCommand", "extendOptions", "addTag", "setMeta", "getMeta", "runStep"].includes(
        commandName,
    );

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
    profiler?: ProfilerRuntimeLike;
}

type ProfilerHooksData = HooksData & { profiler: ProfilerRuntimeLike };

interface RunWithHistoryHooksData<T> extends HooksData {
    nodeData: NodeData;
    fn: () => T;
}

interface RequestDomSnapshotsData extends HooksData {
    attempt?: number;
    currentTest?: Test;
}

export const runWithoutHistory = async <T>(_: unknown, fn: () => T): Promise<T> => {
    return runWithHistoryContext({ shouldBypassHistory: true }, fn) as T;
};

export const requestDomSnapshots = ({
    session,
    callstack,
    snapshotsPromiseRef,
    config,
    attempt,
    currentTest,
}: RequestDomSnapshotsData): void => {
    debugTimeTravel("requestDomSnapshots, called");
    try {
        if (!callstack) {
            debugTimeTravel("requestDomSnapshots, callstack is not defined");
            return;
        }

        const timeTravelMode = config.timeTravel.mode;
        const isRetry = (attempt ?? session.executionContext?.ctx?.attempt ?? 0) > 0;
        const shouldRecord = shouldRecordSnapshots(timeTravelMode, isRetry);
        const test = currentTest ?? session.executionContext?.ctx?.currentTest;

        if (shouldRecord && process.send && test) {
            debugTimeTravel("requestDomSnapshots, shouldRecord and process.send and test are true");
            const rrwebPromise = installRrwebAndCollectEvents(session, callstack)
                .then(rrwebEvents => {
                    const rrwebEventsFiltered = filterEvents(rrwebEvents);
                    sendFilteredEvents(test, rrwebEventsFiltered);
                })
                .catch(e => {
                    debug("An error occurred during capturing snapshots in browser: %O", e);
                });

            snapshotsPromiseRef.current = snapshotsPromiseRef.current.then(() => rrwebPromise);
        }
        debugTimeTravel("requestDomSnapshots, done");
    } catch (e) {
        debug("An error occurred during capturing snapshots in browser: %O", e);
    }
};

type CleanupDomSnapshotsData = Pick<HooksData, "session" | "callstack">;

export const cleanupDomSnapshots = async ({ session, callstack }: CleanupDomSnapshotsData): Promise<void> => {
    if (!callstack) {
        return;
    }

    try {
        await cleanupRrweb(session, callstack);
    } catch (e) {
        debug("An error occurred during cleaning up snapshots in browser: %O", e);
    }
};

const runWithHistoryHooks = <T>({
    session,
    callstack,
    snapshotsPromiseRef,
    nodeData,
    fn,
    config,
    profiler = noopProfilerRuntime,
}: RunWithHistoryHooksData<T>): T => {
    nodeData.key = nodeData.key ?? Symbol();

    const runHistory = (): T => {
        if (config.saveHistoryMode === SAVE_HISTORY_MODE.NONE) {
            return fn();
        }
        if (getHistoryContext()?.shouldBypassHistory) {
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
                        const isInterestingStep =
                            !nodeData.name.startsWith("is") &&
                            !nodeData.name.startsWith("get") &&
                            !nodeData.name.startsWith("$") &&
                            !nodeData.name.startsWith("wait");

                        if (isInterestingStep) {
                            requestDomSnapshots({ session, callstack, snapshotsPromiseRef, config });
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

    // Avoid building sanitized attributes on the history-on / profiler-off|low hot path.
    if (!profiler.isEnabled(3)) {
        return runHistory();
    }

    return profiler.withSpan(
        "browser.command",
        {
            minLevel: 3,
            name: nodeData.name,
            source: nodeData.source,
            attributes: getProfilerCommandAttributes(nodeData),
        },
        runHistory,
    );
};

const overwriteAddCommand = (hooks: ProfilerHooksData): void => {
    const { session, profiler } = hooks;
    session.overwriteCommand("addCommand", (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }

        const source = profiler.isEnabled(3) ? captureCommandRegistrationSource() : undefined;
        function decoratedWrapper(this: WebdriverIO.Browser, ...args: unknown[]): unknown {
            return runWithHistoryHooks({
                ...hooks,
                nodeData: { name, args, elementScope, custom: true, overwrite: false, source },
                fn: () => wrapper.apply(this, args),
            });
        }

        return origCommand(name, decoratedWrapper, elementScope);
    });
};

const overwriteOverwriteCommand = (hooks: ProfilerHooksData): void => {
    const { session, profiler } = hooks;
    session.overwriteCommand("overwriteCommand", (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }

        const source = profiler.isEnabled(3) ? captureCommandRegistrationSource() : undefined;
        function decoratedWrapper(
            this: WebdriverIO.Browser,
            origFn: (...args: unknown[]) => unknown,
            ...args: unknown[]
        ): unknown {
            return runWithHistoryHooks({
                ...hooks,
                nodeData: { name, args, elementScope, overwrite: true, source },
                fn: () => (wrapper as (...args: unknown[]) => unknown).apply(this, [origFn, ...args]),
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return origCommand(name, decoratedWrapper as any, elementScope);
    });
};

interface OverwriteCommandsData extends ProfilerHooksData {
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
    profiler,
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
                profiler,
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.overwriteCommand(name as any, decoratedWrapper as any, elementScope as any);
    });
};

export const runGroup = <T>(
    { session, callstack, snapshotsPromiseRef, config, profiler }: HooksData,
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
        profiler,
    });
};

const overwriteRunStepCommand = (hooks: ProfilerHooksData): void => {
    const { session } = hooks;
    session.overwriteCommand("runStep", (origCommand, stepName: string, stepCb) => {
        return runGroup(hooks, stepName, () => origCommand(stepName, stepCb));
    });
};

interface InitHistoryResult {
    callstack: Callstack;
    snapshotsPromiseRef: PromiseRef;
}

export const initCommandHistory = (
    session: WebdriverIO.Browser,
    config: BrowserConfig,
    profiler: ProfilerRuntimeLike = noopProfilerRuntime,
): InitHistoryResult => {
    const callstack = new Callstack();
    const snapshotsPromiseRef: PromiseRef = { current: Promise.resolve() };
    const hooks = { session, callstack, snapshotsPromiseRef, config, profiler };

    overwriteAddCommand(hooks);
    overwriteCommands({
        ...hooks,
        commands: cmds.getBrowserCommands().filter(command => !shouldNotWrapCommand(command)),
        elementScope: false,
    });
    overwriteCommands({ ...hooks, commands: cmds.getElementCommands(), elementScope: true });
    overwriteOverwriteCommand(hooks);
    overwriteRunStepCommand(hooks);

    return { callstack, snapshotsPromiseRef };
};

function getProfilerCommandAttributes(nodeData: NodeData): Record<string, string | number | boolean | null> {
    const attributes: Record<string, string | number | boolean | null> = {
        command: nodeData.name,
        scope: nodeData.elementScope ? "element" : "browser",
        custom: Boolean(nodeData.custom),
        overwritten: Boolean(nodeData.overwrite),
    };

    if (nodeData.name === "pause") {
        const duration = nodeData.args[0];
        if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0) {
            attributes.requestedDurationMs = duration;
        }
    } else if ((nodeData.name === "url" || nodeData.name === "navigateTo") && typeof nodeData.args[0] === "string") {
        profilerSanitizer ??= new ProfilerSanitizer();
        attributes.url = profilerSanitizer.url(nodeData.args[0]);
    }

    return attributes;
}

function captureCommandRegistrationSource(): SourceRef | undefined {
    const stackTraceLimit = Error.stackTraceLimit;
    try {
        Error.stackTraceLimit = Math.max(stackTraceLimit, 50);
        const candidates = ErrorStackParser.parse(new Error()).filter(
            candidate => candidate.fileName && !isInternalCommandFrame(candidate.fileName),
        );
        const frame = candidates.find(candidate => !isNodeModulesFrame(candidate.fileName)) ?? candidates[0];
        if (!frame?.fileName) {
            return;
        }

        profilerSanitizer ??= new ProfilerSanitizer();
        return {
            file: profilerSanitizer.path(softFileURLToPath(frame.fileName)),
            line: frame.lineNumber,
            column: frame.columnNumber,
            confidence: "medium",
        };
    } catch {
        // Source attribution is best-effort and must not break command registration.
        return;
    } finally {
        Error.stackTraceLimit = stackTraceLimit;
    }
}

function isInternalCommandFrame(fileName: string): boolean {
    const file = softFileURLToPath(fileName);
    const normalizedFile = normalizeStackFile(file);
    const relative = path.relative(testplaneRoot, file).split(path.sep).join("/");

    return (
        commandWrapperDirectories.some(directory => relative.startsWith(directory)) ||
        normalizedFile.includes("/node_modules/@testplane/webdriverio/") ||
        normalizedFile.includes("/gemini-testing/webdriverio/") ||
        normalizedFile.startsWith("node:")
    );
}

function isNodeModulesFrame(fileName: string | undefined): boolean {
    return fileName ? normalizeStackFile(softFileURLToPath(fileName)).includes("/node_modules/") : false;
}

function normalizeStackFile(fileName: string): string {
    return fileName.replaceAll("\\", "/");
}
