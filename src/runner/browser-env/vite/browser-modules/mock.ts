// This module replaces testplane import and works only in browser environment

export * from "@vitest/spy";
export { Key } from "@testplane/webdriverio";
import type { MockFactory } from "./types.js";

// solution found here - https://stackoverflow.com/questions/48674303/resolve-relative-path-to-absolute-url-from-es6-module-in-browser
const a = document.createElement("a");
function resolveUrl(path: string): string {
    a.href = path;
    return a.href;
}

export async function mock(moduleName: string, factory?: MockFactory, originalImport?: unknown): Promise<void> {
    // Mock call without factory parameter is handled by manual-mock module and is being removed from the source code by mock vite plugin
    if (!factory || typeof factory !== "function") {
        return;
    }

    const { file, mockCache } = window.__testplane__;
    const isModuleLocal = moduleName.startsWith("./") || moduleName.startsWith("../");

    let mockPath: string;

    if (isModuleLocal) {
        const absModuleUrl = resolveUrl(file.split("/").slice(0, -1).join("/") + `/${moduleName}`);

        mockPath = new URL(absModuleUrl).pathname;
    } else {
        mockPath = moduleName;
    }

    try {
        const resolvedMock = await factory(originalImport);
        mockCache.set(mockPath, resolvedMock);
    } catch (err: unknown) {
        const error = err as Error;
        const lines: string[] = [];
        lines.push(`What happened: The mock factory function for module "${moduleName}" threw an error.`);
        lines.push("\nPossible reasons:");
        lines.push("  - The factory function contains a runtime error (e.g. undefined reference, type error)");
        lines.push("  - The factory function is async and an awaited promise was rejected");
        lines.push("  - 'originalImport' passed to the factory is undefined or has unexpected shape");
        lines.push("\nWhat you can do:");
        lines.push("  - Review the mock factory body for any errors");
        lines.push(`  - Check the full stack trace below:\n${error.stack}`);
        throw new Error(lines.join("\n"));
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function unmock(_moduleName: string): void {
    // is implemented in manual-mock module and is being removed from the source code by mock vite plugin
}
