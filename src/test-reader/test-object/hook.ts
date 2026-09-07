import { TestObject } from "./test-object";
import type { TestObjectData, ConfigurableTestObjectData, TestFunction, TestFunctionCtx, Location } from "./types";

type HookOpts = TestObjectData & {
    fn: TestFunction<TestFunctionCtx>;
    location?: Location;
};

export class Hook extends TestObject {
    public fn: TestFunction<TestFunctionCtx>;
    public readonly location?: Location;

    static create<T extends Hook>(this: new (opts: HookOpts) => T, opts: HookOpts): T {
        return new this(opts);
    }

    constructor({ title, fn, location }: HookOpts) {
        super({ title });

        this.fn = fn;
        this.location = location;
    }

    clone(): Hook {
        return new Hook({
            title: this.title,
            fn: this.fn,
            location: this.location,
        }).assign(this);
    }

    get file(): ConfigurableTestObjectData["file"] {
        return this.parent ? this.parent.file : "";
    }

    get timeout(): ConfigurableTestObjectData["timeout"] {
        return this.parent ? this.parent.timeout : 0;
    }

    get browserId(): ConfigurableTestObjectData["browserId"] {
        return this.parent ? this.parent.browserId : "";
    }
}
