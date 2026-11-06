import type ts from "typescript";

export interface MissingAwaitDiagnostic {
    code: "missing-await";
    file: string;
    line: number;
    column: number;
    command: string;
    message: string;
}

export interface FileAnalysisDiagnostic {
    code: "parse-error" | "read-error" | "unsupported-file" | "unsupported-ui" | "missing-source";
    file: string;
    message: string;
    line?: number;
    column?: number;
}

export type PreflightDiagnostic = MissingAwaitDiagnostic | FileAnalysisDiagnostic;

export interface AnalyzeOptions {
    file: string;
    mochaUi?: "bdd" | "tdd" | "qunit";
    program?: ts.Program;
}
