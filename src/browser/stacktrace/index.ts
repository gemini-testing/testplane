import { ShallowStackFrames, applyStackTraceIfBetter, captureRawStackFrames } from "./utils";
import { getBrowserCommands, getElementCommands } from "../history/commands";
import { runWithHooks } from "../history/utils";

type AnyFunc = (...args: any[]) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

export const runWithStacktraceHooks = ({
    stackFrames,
    fn,
    stackFilterFunc,
}: {
    stackFrames: ShallowStackFrames;
    fn: AnyFunc;
    stackFilterFunc?: AnyFunc;
}): ReturnType<typeof fn> => {
    const frames = captureRawStackFrames(stackFilterFunc || runWithStacktraceHooks);

    if (stackFrames.areInternal(frames)) {
        return fn();
    }

    const key = stackFrames.getKey();

    return runWithHooks({
        before: () => stackFrames.enter(key, frames),
        fn,
        after: () => stackFrames.leave(key),
        error: (err) => applyStackTraceIfBetter(err, frames),
    });
};

const overwriteAddCommand = (session: WebdriverIO.Browser, stackFrames: ShallowStackFrames): void =>
    session.overwriteCommand("addCommand", function (this, origCommand, name, wrapper, elementScope): unknown {
        type parentThis = typeof this;
        function decoratedWrapper(this: parentThis, ...args: unknown[]): unknown {
            return runWithStacktraceHooks({
                stackFrames,
                fn: () => wrapper.apply(this, args),
                stackFilterFunc: decoratedWrapper,
            });
        }

        return origCommand.call(this, name, decoratedWrapper, elementScope);
    });

const overwriteOverwriteCommand = (session: WebdriverIO.Browser, stackFrames: ShallowStackFrames): void =>
    session.overwriteCommand(
        "overwriteCommand",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function (this, origCommand: any, name, wrapper: AnyFunc, elementScope): unknown {
            function decoratedWrapper(this: unknown, origFn: unknown, ...args: unknown[]): unknown {
                return runWithStacktraceHooks({
                    stackFrames,
                    fn: () => wrapper.call(this, origFn, ...args),
                    stackFilterFunc: decoratedWrapper,
                });
            }
            return origCommand.call(
                this,
                name,
                decoratedWrapper as WebdriverIO.OverwriteCommandFn<
                    WebdriverIO.Browser | WebdriverIO.Element,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (...args: any) => any
                >,
                elementScope,
            );
        },
    );

const overwriteCommands = ({
    session,
    stackFrames,
    commands,
    elementScope,
}: {
    session: WebdriverIO.Browser;
    stackFrames: ShallowStackFrames;
    commands: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    elementScope: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}): void =>
    commands.forEach(name => {
        function decoratedWrapper(this: unknown, origFn: (...args: unknown[]) => unknown, ...args: unknown[]): unknown {
            return runWithStacktraceHooks({
                stackFrames,
                fn: () => origFn.apply(this, args),
                stackFilterFunc: decoratedWrapper,
            });
        }

        session.overwriteCommand(name, decoratedWrapper, elementScope);
    });

const overwriteBrowserCommands = (session: WebdriverIO.Browser, stackFrames: ShallowStackFrames): void =>
    overwriteCommands({
        session,
        stackFrames,
        commands: getBrowserCommands(),
        elementScope: false,
    });

const overwriteElementCommands = (session: WebdriverIO.Browser, stackFrames: ShallowStackFrames): void =>
    overwriteCommands({
        session,
        stackFrames,
        commands: getElementCommands(),
        elementScope: true,
    });

export const enhanceStacktraces = (session: WebdriverIO.Browser): void => {
    const stackFrames = new ShallowStackFrames();

    overwriteAddCommand(session, stackFrames);
    overwriteBrowserCommands(session, stackFrames);
    overwriteElementCommands(session, stackFrames);
    overwriteOverwriteCommand(session, stackFrames);
};
