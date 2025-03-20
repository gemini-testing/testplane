import { ConfigurableTestObject } from "./configurable-test-object";
import type { TestObjectData, TestFunction, TestFunctionCtx } from "./types";
type TestOpts = TestObjectData & Pick<ConfigurableTestObject, "file" | "id" | "location"> & {
    fn: TestFunction<TestFunctionCtx>;
};
export declare class Test extends ConfigurableTestObject {
    fn: TestFunction<TestFunctionCtx>;
    err?: Error;
    static create<T extends Test>(this: new (opts: TestOpts) => T, opts: TestOpts): T;
    constructor({ title, file, id, location, fn }: TestOpts);
    clone(): Test;
}
export {};
