import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TestPreflightError } from "../../errors/test-preflight-error";
import { analyzeMissingAwait } from "./analyze";
import { createTypeProgram, extensions, groupByConfig } from "./type-info";
import type { TestCollection } from "../../test-collection";
import type { MochaOpts } from "../../config/types";
import type { PreflightDiagnostic } from "./types";

export async function validateTestCollection(
    collection: TestCollection,
    options: { mochaUi?: MochaOpts["ui"] } = {},
): Promise<void> {
    const tests = collection.mapTests(test => test).filter(test => !test.pending && !test.disabled);
    if (!tests.length) return;
    const ui = options.mochaUi ?? "bdd";
    if (ui !== "bdd" && ui !== "tdd" && ui !== "qunit") {
        throw new TestPreflightError([
            {
                code: "unsupported-ui",
                file: "<collection>",
                message:
                    "Missing-await analysis supports bdd, tdd and qunit. Set system.checkMissingAwait=false for a custom UI.",
            },
        ]);
    }

    const diagnostics: PreflightDiagnostic[] = [];
    const files = new Set<string>();
    const sources = new Map<string, string>();
    for (const test of tests) {
        if (!test.file)
            diagnostics.push({
                code: "missing-source",
                file: `<test "${test.title}">`,
                message: "An active test has no source file for missing-await analysis.",
            });
        else files.add(test.file);
    }
    for (const file of [...files].sort()) {
        try {
            if ((/^[a-z]+:\/\//i.test(file) && !file.startsWith("file://")) || !extensions.has(path.extname(file))) {
                diagnostics.push({
                    code: "unsupported-file",
                    file,
                    message: "Missing-await analysis requires a local JS/TS source file.",
                });
                continue;
            }
            const real = await fs.realpath(file.startsWith("file://") ? fileURLToPath(file) : path.resolve(file));
            if (!sources.has(real)) sources.set(real, await fs.readFile(real, "utf8"));
        } catch (error) {
            diagnostics.push({ code: "read-error", file, message: (error as Error).message });
        }
    }

    for (const [config, group] of groupByConfig(sources.keys())) {
        let program;
        try {
            program = createTypeProgram(group, sources, config);
        } catch (error) {
            diagnostics.push({ code: "parse-error", file: config ?? group[0], message: (error as Error).message });
            continue;
        }
        for (const file of group) {
            try {
                diagnostics.push(...analyzeMissingAwait(sources.get(file)!, { file, mochaUi: ui, program }));
            } catch (error) {
                const e = error as Error & { line?: number; column?: number };
                diagnostics.push({ code: "parse-error", file, message: e.message, line: e.line, column: e.column });
            }
        }
    }
    if (diagnostics.length) throw new TestPreflightError(diagnostics, sources);
}
