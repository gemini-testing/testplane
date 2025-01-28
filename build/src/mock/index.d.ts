export * from "./vitest-spy";
type MockFactory = (originalImport?: unknown) => unknown;
export declare function mock(_moduleName: string, _factory?: MockFactory): void;
export declare function unmock(_moduleName: string): void;
