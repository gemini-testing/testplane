import { ConfigurableTestObject } from "./configurable-test-object";
import type { TestObjectData, TestFunction, TestFunctionCtx } from "./types";

type TestOpts = TestObjectData &
    Pick<ConfigurableTestObject, "file" | "id" | "location"> & {
        fn: TestFunction<TestFunctionCtx>;
    };

export class Test extends ConfigurableTestObject {
    public fn: TestFunction<TestFunctionCtx>;
    public err?: Error;

    static create<T extends Test>(this: new (opts: TestOpts) => T, opts: TestOpts): T {
        return new this(opts);
    }

    constructor({ title, file, id, location, fn }: TestOpts) {
        super({ title, file, id, location });

        this.fn = fn;
    }

    clone(): Test {
        return new Test({
            title: this.title,
            file: this.file,
            id: this.id,
            location: this.location,
            fn: this.fn,
        }).assign(this);
    }
}
