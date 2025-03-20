import { Callstack } from "./callstack";
import { TestStep } from "../../types";
export declare const shouldPropagateFn: (parentNode: TestStep, currentNode: TestStep) => boolean;
export declare const runGroup: <T>(callstack: Callstack | null, name: string, fn: () => T) => T;
export declare const initCommandHistory: (session: WebdriverIO.Browser) => Callstack;
