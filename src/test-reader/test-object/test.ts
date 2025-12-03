import { ConfigurableTestObject } from "./configurable-test-object";
import type { TestObjectData, TestFunction, TestFunctionCtx, TestTag } from "./types";

type TestOpts = TestObjectData &
    Pick<ConfigurableTestObject, "file" | "id" | "location"> & {
        fn: TestFunction<TestFunctionCtx>;
        tags?: TestTag[];
    };

export class Test extends ConfigurableTestObject {
    public fn: TestFunction<TestFunctionCtx>;
    public tags: Map<string, boolean>;
    public err?: Error;

    static create<T extends Test>(this: new (opts: TestOpts) => T, opts: TestOpts): T {
        return new this(opts);
    }

    constructor({ title, file, id, location, fn, tags }: TestOpts) {
        super({ title, file, id, location });

        this.fn = fn;
        this.tags = new Map(tags?.map(({ title, dynamic }) => [title, Boolean(dynamic)]) || []);
    }

    addTag(tag: string | string[]): void {
        if (Array.isArray(tag)) {
            tag.forEach(element => this.tags.set(element, true));
        } else {
            this.tags.set(tag, true);
        }
    }

    hasTag(tag: string): boolean {
        return this.tags.has(tag);
    }

    getTags(): TestTag[] {
        return Array.from(this.tags.keys()).map(title => ({
            title,
            dynamic: this.tags.get(title),
        }));
    }

    clone(): Test {
        return new Test({
            title: this.title,
            tags: this.getTags(),
            file: this.file,
            id: this.id,
            location: this.location,
            fn: this.fn,
        }).assign(this);
    }
}
