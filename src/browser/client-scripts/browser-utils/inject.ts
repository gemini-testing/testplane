import * as implementation from "./implementation";

declare global {
    // eslint-disable-next-line no-var
    var __geminiCore: Record<string, unknown> | undefined;
    // eslint-disable-next-line no-var
    var __geminiNamespace: string;
}

const globalObj = typeof window === "undefined" ? globalThis : window;

if (!globalObj.__geminiCore) {
    globalObj.__geminiCore = {};
}
globalObj.__geminiCore[__geminiNamespace] = implementation;
