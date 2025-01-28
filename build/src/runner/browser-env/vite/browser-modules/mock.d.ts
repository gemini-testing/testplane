export * from "@vitest/spy";
export { Key } from "@testplane/webdriverio";
import type { MockFactory } from "./types.js";
export declare function mock(moduleName: string, factory?: MockFactory, originalImport?: unknown): Promise<void>;
export declare function unmock(_moduleName: string): void;
