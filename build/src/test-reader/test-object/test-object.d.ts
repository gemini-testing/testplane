import { Suite } from "./suite";
import type { TestObjectData } from "./types";
export declare class TestObject {
    #private;
    parent: Suite | null;
    constructor({ title }: TestObjectData);
    assign(src: this): this;
    get title(): string;
    titlePath(): string[];
    fullTitle(): string;
}
