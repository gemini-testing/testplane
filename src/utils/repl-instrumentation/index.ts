import RuntimeConfig from "../../config/runtime-config";
import { instrumentWithTypeScript } from "./typescript";

type TypeScriptModule = typeof import("typescript");

let typescript: TypeScriptModule | null | undefined;

export const instrumentReplIfNeeded = (code: string, sourceFile: string): string => {
    const replMode = RuntimeConfig.getInstance()?.replMode;

    if (!replMode?.enabled) {
        return code;
    }

    const TEST_CALL_RE = /\bit(?:\.\w+)*\s*\(/;
    const shouldTryInstrumentation = code.includes("switchToRepl") || (replMode.beforeTest && TEST_CALL_RE.test(code));
    if (!shouldTryInstrumentation) {
        return code;
    }

    const ts = getTypeScript();

    if (!ts) {
        return code;
    }

    try {
        return instrumentWithTypeScript(ts, code, sourceFile, { beforeTest: Boolean(replMode.beforeTest) });
    } catch {
        return code;
    }
};

function getTypeScript(): TypeScriptModule | null {
    if (typescript !== undefined) {
        return typescript;
    }

    try {
        // TypeScript is optional for published consumers; REPL locals are best-effort without it.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        typescript = require("typescript");
    } catch {
        typescript = null;
    }

    return typescript || null;
}
