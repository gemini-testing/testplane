import { TestStep } from "../../types";
type HookFunctions<T> = {
    fn: () => T;
    before: () => void;
    after: () => void;
    error: (err: unknown) => unknown;
};
export declare const normalizeCommandArgs: (commandName: string, args?: unknown[]) => string[];
export declare const isGroup: (node: TestStep) => boolean;
export declare const runWithHooks: <T>({ fn, before, after, error }: HookFunctions<T>) => T;
export {};
