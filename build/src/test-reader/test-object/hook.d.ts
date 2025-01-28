import { TestObject } from "./test-object";
import type { TestObjectData, ConfigurableTestObjectData, TestFunction, TestFunctionCtx } from "./types";
type HookOpts = TestObjectData & {
    fn: TestFunction<TestFunctionCtx>;
};
export declare class Hook extends TestObject {
    fn: TestFunction<TestFunctionCtx>;
    static create<T extends Hook>(this: new (opts: HookOpts) => T, opts: HookOpts): T;
    constructor({ title, fn }: HookOpts);
    clone(): Hook;
    get file(): ConfigurableTestObjectData["file"];
    get timeout(): ConfigurableTestObjectData["timeout"];
    get browserId(): ConfigurableTestObjectData["browserId"];
}
export {};
