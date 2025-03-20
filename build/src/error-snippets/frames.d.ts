import type { ResolvedFrame, SufficientStackFrame } from "./types";
export declare const findRelevantStackFrame: (error: Error) => SufficientStackFrame | null;
export declare const resolveLocationWithStackFrame: (stackFrame: SufficientStackFrame, fileContents: string) => ResolvedFrame;
