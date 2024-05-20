import { TestObject } from "./test-object";
import type { TestObjectData, ConfigurableTestObjectData, TestFunction, TestFunctionCtx } from "./types";

type HookOpts = TestObjectData & {
    fn: TestFunction<TestFunctionCtx>;
};

export class Hook extends TestObject {
    public fn: TestFunction<TestFunctionCtx>;

    static create<T extends Hook>(this: new (opts: HookOpts) => T, opts: HookOpts): T {
        return new this(opts);
    }

    constructor({ title, fn }: HookOpts) {
        super({ title });

        this.fn = fn;
    }

    clone(): Hook {
        return new Hook({
            title: this.title,
            fn: this.fn,
        }).assign(this);
    }

    get file(): ConfigurableTestObjectData["file"] {
        return this.parent ? this.parent.file : "";
    }

    get timeout(): ConfigurableTestObjectData["timeout"] {
        return this.parent ? this.parent.timeout : 0;
    }

    get browserId(): ConfigurableTestObjectData["browserId"] {
        return this.parent ? this.parent.browserId : undefined;
    }
}
