import { formatErrorSnippet } from "../error-snippets/utils";
import type { PreflightDiagnostic } from "../test-reader/await-check/types";

export class TestPreflightError extends Error {
    readonly diagnostics: readonly PreflightDiagnostic[];
    readonly snippet: string;

    constructor(diagnostics: readonly PreflightDiagnostic[], sources: ReadonlyMap<string, string> = new Map()) {
        const unique = [
            ...new Map(
                diagnostics.map(d => [JSON.stringify([d.file, d.line, d.column, d.code, d.message]), d]),
            ).values(),
        ].sort(
            (a, b) =>
                a.file.localeCompare(b.file, "en") ||
                (a.line ?? 0) - (b.line ?? 0) ||
                (a.column ?? 0) - (b.column ?? 0) ||
                a.code.localeCompare(b.code),
        );
        const missing = unique.filter(d => d.code === "missing-await").length;
        super(
            `Test preflight failed: ${missing} missing await error(s), ${
                unique.length - missing
            } file analysis error(s). No tests were started.`,
        );
        this.name = "TestPreflightError";
        this.diagnostics = unique;
        this.snippet = unique
            .map(d => {
                const source = sources.get(d.file);
                const location =
                    d.line !== undefined && d.column !== undefined ? { line: d.line, column: d.column } : undefined;
                const header = `${d.file}${location ? `:${location.line}:${location.column}` : ""}: ${d.message}`;
                return (
                    header +
                    (source !== undefined && location
                        ? formatErrorSnippet(new Error(d.message), { file: d.file, source, location })
                        : "\n")
                );
            })
            .join("\n");
        // The CLI prints stack rather than snippet. No fabricated runtime stack frames are needed.
        this.stack = `${this.name}: ${this.message}\n\n${this.snippet}`;
    }
}
