import * as nodeModule from "node:module";
import type { LoadFnOutput, LoadHookContext, ModuleHooks, ModuleSource } from "node:module";
import { Command } from "@gemini-testing/commander";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addHook } from "pirates";
import { addReplOptions, isReplModeEnabled } from "../cli/repl-options";
import { instrumentReplIfNeeded } from "./repl-instrumentation";
import * as logger from "./logger";

const TESTPLANE_REPL_MODULE_HOOK = Symbol.for("testplane.repl.module.hook");
const TRANSFORM_CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"];

type ProcessWithReplModuleHook = typeof process & {
    [TESTPLANE_REPL_MODULE_HOOK]?: { revert: () => void };
};

export const registerReplModuleHooks = (): void => {
    const processWithHook = process as ProcessWithReplModuleHook;

    if (processWithHook[TESTPLANE_REPL_MODULE_HOOK]) {
        return;
    }

    const program = addReplOptions(new Command("testplane").allowUnknownOption().option("-h, --help"));

    program.parse(process.argv);

    if (!isReplModeEnabled(program)) {
        return;
    }

    const hook = registerNodeModuleHooks() || registerPiratesHook();

    processWithHook[TESTPLANE_REPL_MODULE_HOOK] = hook;
};

function registerNodeModuleHooks(): { revert: () => void } | null {
    const registerHooks = nodeModule.registerHooks;

    if (typeof registerHooks !== "function") {
        return null;
    }

    const hooks: ModuleHooks = registerHooks({
        load(url, context, nextLoad) {
            let result: LoadFnOutput;

            try {
                result = nextLoad(url, context);
            } catch (err) {
                // https://github.com/nodejs/node/issues/57327
                // Fixed for REPL instrumentation in Node 24.13.0; older versions mishandle CJS sources with mixed sync/async hooks.
                return instrumentLoadAfterFailedLoad(url, context, err);
            }

            return instrumentLoadResult(url, result);
        },
    });

    return { revert: () => hooks.deregister() };
}

function registerPiratesHook(): { revert: () => void } {
    const revert = addHook((code, sourceFile) => safeInstrumentRepl(code, sourceFile), {
        exts: TRANSFORM_CODE_EXTENSIONS,
        ignoreNodeModules: true,
    });

    return { revert };
}

function instrumentLoadAfterFailedLoad(url: string, context: LoadHookContext, err: unknown): LoadFnOutput {
    const sourceFile = getSourceFileFromUrl(url);

    if (!isInvalidLoadSourceError(err) || !sourceFile || !shouldReadSourceFile(sourceFile)) {
        throw err;
    }

    const source = readSourceFile(sourceFile);

    if (source === null) {
        throw err;
    }

    return {
        format: getFallbackFormat(context, sourceFile),
        shortCircuit: true,
        source: shouldHandleSourceFile(sourceFile) ? safeInstrumentRepl(source, sourceFile) : source,
    };
}

function instrumentLoadResult(url: string, result: LoadFnOutput): LoadFnOutput {
    const sourceFile = getSourceFileFromUrl(url);

    if (!sourceFile || !shouldHandleSourceFile(sourceFile)) {
        return result;
    }

    const resultSource = result.source as ModuleSource | null | undefined;
    const source =
        resultSource === null || resultSource === undefined
            ? readSourceFile(sourceFile)
            : moduleSourceToString(resultSource);

    if (source === null) {
        return result;
    }

    return { ...result, source: safeInstrumentRepl(source, sourceFile) };
}

function safeInstrumentRepl(source: string, sourceFile: string): string {
    try {
        return instrumentReplIfNeeded(source, sourceFile);
    } catch (err) {
        logger.warn(`Failed to instrument ${sourceFile} for REPL mode: ${(err as Error).message}.`);
        return source;
    }
}

function readSourceFile(sourceFile: string): string | null {
    try {
        return readFileSync(sourceFile, "utf8");
    } catch {
        return null;
    }
}

function isInvalidLoadSourceError(err: unknown): boolean {
    if (!(err instanceof Error)) {
        return false;
    }

    const error = err as Error & { code?: string };

    return (
        error.code === "ERR_INVALID_RETURN_PROPERTY_VALUE" &&
        error.message.includes('"source"') &&
        error.message.includes('"load" hook')
    );
}

function shouldReadSourceFile(sourceFile: string): boolean {
    return TRANSFORM_CODE_EXTENSIONS.includes(path.extname(sourceFile));
}

function getFallbackFormat(context: LoadHookContext, sourceFile: string): string {
    if (context.format) {
        return context.format;
    }

    switch (path.extname(sourceFile)) {
        case ".mjs":
            return "module";
        case ".mts":
            return "module-typescript";
        case ".ts":
        case ".tsx":
        case ".cts":
            return "commonjs-typescript";
        default:
            return "commonjs";
    }
}

function getSourceFileFromUrl(url: string): string | null {
    try {
        return url.startsWith("file:") ? fileURLToPath(url) : null;
    } catch {
        return null;
    }
}

function shouldHandleSourceFile(sourceFile: string): boolean {
    return (
        shouldReadSourceFile(sourceFile) && !sourceFile.includes(`${path.sep}node_modules${path.sep}`)
    );
}

function moduleSourceToString(source: ModuleSource): string | null {
    if (typeof source === "string") {
        return source;
    }

    if (source instanceof ArrayBuffer) {
        return Buffer.from(source).toString();
    }

    if (ArrayBuffer.isView(source)) {
        return Buffer.from(source.buffer, source.byteOffset, source.byteLength).toString();
    }

    return null;
}
