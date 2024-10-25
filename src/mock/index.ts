export * from "./vitest-spy";

// TODO: use from browser code when migrate to esm
type MockFactory = (originalImport?: unknown) => unknown;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function mock(_moduleName: string, _factory?: MockFactory): void {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function unmock(_moduleName: string): void {}
