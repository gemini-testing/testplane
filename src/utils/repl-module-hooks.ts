import * as nodeModule from "node:module";
import type { LoadFnOutput, ModuleHooks, ModuleSource } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addHook } from "pirates";
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
            const result = nextLoad(url, context);

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

function instrumentLoadResult(url: string, result: LoadFnOutput): LoadFnOutput {
    const sourceFile = getSourceFileFromUrl(url);

    if (!sourceFile || !result.source || !shouldHandleSourceFile(sourceFile)) {
        return result;
    }

    const source = moduleSourceToString(result.source);

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

function getSourceFileFromUrl(url: string): string | null {
    try {
        return url.startsWith("file:") ? fileURLToPath(url) : null;
    } catch {
        return null;
    }
}

function shouldHandleSourceFile(sourceFile: string): boolean {
    return (
        TRANSFORM_CODE_EXTENSIONS.includes(path.extname(sourceFile)) &&
        !sourceFile.includes(`${path.sep}node_modules${path.sep}`)
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
