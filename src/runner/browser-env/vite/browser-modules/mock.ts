// This module replaces testplane import and works only in browser environment

export * from "@vitest/spy";
export { Key } from "webdriverio";
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
        throw new Error(`There was an error in mock factory of module "${moduleName}":\n${error.stack}`);
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function unmock(_moduleName: string): void {
    // is implemented in manual-mock module and is being removed from the source code by mock vite plugin
}
