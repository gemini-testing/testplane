import type { SetRequired } from "type-fest";

export type WithSnippetError = Error & { snippet?: string };

export type SufficientStackFrame = SetRequired<StackFrame, "fileName" | "lineNumber" | "columnNumber">;

export type ResolvedFrame = { source: string; file: string; location: { line: number; column: number } };
