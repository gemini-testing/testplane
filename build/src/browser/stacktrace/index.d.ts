import { ShallowStackFrames } from "./utils";
type AnyFunc = (...args: any[]) => unknown;
export declare const runWithStacktraceHooks: ({ stackFrames, fn, stackFilterFunc, }: {
    stackFrames: ShallowStackFrames;
    fn: AnyFunc;
    stackFilterFunc?: AnyFunc | undefined;
}) => unknown;
export declare const enhanceStacktraces: (session: WebdriverIO.Browser) => void;
export {};
