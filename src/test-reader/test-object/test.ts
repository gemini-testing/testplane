import { ConfigurableTestObject } from "./configurable-test-object";
import type { TestObjectData, TestFunction, TestFunctionCtx, TestTag } from "./types";

type TestOpts = TestObjectData &
    Pick<ConfigurableTestObject, "file" | "id" | "location"> & {
        fn: TestFunction<TestFunctionCtx>;
        tag?: TestTag[];
    };

export class Test extends ConfigurableTestObject {
    public fn: TestFunction<TestFunctionCtx>;
    public tag: Map<string, boolean>;
    public err?: Error;

    static create<T extends Test>(this: new (opts: TestOpts) => T, opts: TestOpts): T {
        return new this(opts);
    }

    constructor({ title, file, id, location, fn, tag }: TestOpts) {
        super({ title, file, id, location });

        this.fn = fn;
        this.tag = new Map(tag?.map(({ title, dynamic }) => [title, !!dynamic]) || []);
    }

    addTag(tag: string | string[]): void {
        if (Array.isArray(tag)) {
            tag.forEach(element => this.tag.set(element, true));
        } else {
            this.tag.set(tag, true);
        }
    }

    hasTag(tag: string): boolean {
        return this.tag.has(tag);
    }

    getTag(): TestTag[] {
        return Array.from(this.tag.keys()).map(title => ({
            title,
            dynamic: this.tag.get(title),
        }));
    }

    clone(): Test {
        return new Test({
            title: this.title,
            tag: this.getTag(),
            file: this.file,
            id: this.id,
            location: this.location,
            fn: this.fn,
        }).assign(this);
    }
}
