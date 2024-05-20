import { Suite } from "./suite";
import type { TestObjectData } from "./types";

export class TestObject {
    #title: string;
    public parent: Suite | null = null;

    constructor({ title }: TestObjectData) {
        this.#title = title;
    }

    assign(src: this): this {
        return Object.assign(this, src);
    }

    get title(): string {
        return this.#title;
    }

    titlePath(): string[] {
        if (this.parent) {
            const parentTitlePath = this.parent.titlePath();

            return this.title ? parentTitlePath.concat(this.title) : parentTitlePath;
        }

        return this.title ? [this.title] : [];
    }

    fullTitle(): string {
        return this.titlePath().join(" ");
    }
}
