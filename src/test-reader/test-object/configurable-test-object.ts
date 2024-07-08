import _ from "lodash";
import { TestObject } from "./test-object";
import type { ConfigurableTestObjectData, TestObjectData } from "./types";

type ConfigurableTestObjectOpts = Pick<ConfigurableTestObjectData, "file" | "id"> & TestObjectData;

type SkipData = {
    reason: string;
};

export class ConfigurableTestObject extends TestObject {
    #data: ConfigurableTestObjectData;

    constructor({ title, file, id }: ConfigurableTestObjectOpts) {
        super({ title });

        this.#data = { id, file } as ConfigurableTestObjectData;
    }

    assign(src: this): this {
        this.#data = { ...src.#data };

        return super.assign(src);
    }

    skip({ reason }: SkipData): void {
        this.pending = true;
        this.skipReason = reason;
    }

    disable(): void {
        this.disabled = true;
        this.silentSkip = true;
    }

    get id(): ConfigurableTestObjectData["id"] {
        return this.#data.id;
    }

    get file(): ConfigurableTestObjectData["file"] {
        return this.#data.file;
    }

    set pending(val: ConfigurableTestObjectData["pending"]) {
        this.#data.pending = val;
    }

    get pending(): ConfigurableTestObjectData["pending"] {
        return this.#getInheritedProperty<ConfigurableTestObjectData["pending"]>("pending", false);
    }

    set skipReason(reason: ConfigurableTestObjectData["skipReason"]) {
        this.#data.skipReason = reason;
    }

    get skipReason(): ConfigurableTestObjectData["skipReason"] {
        return this.#getInheritedProperty<ConfigurableTestObjectData["skipReason"]>("skipReason", "");
    }

    set disabled(val: ConfigurableTestObjectData["disabled"]) {
        this.#data.disabled = val;
    }

    get disabled(): ConfigurableTestObjectData["disabled"] {
        return this.#getInheritedProperty<ConfigurableTestObjectData["disabled"]>("disabled", false);
    }

    set silentSkip(val: ConfigurableTestObjectData["silentSkip"]) {
        this.#data.silentSkip = val;
    }

    get silentSkip(): ConfigurableTestObjectData["silentSkip"] {
        return this.#getInheritedProperty<ConfigurableTestObjectData["silentSkip"]>("silentSkip", false);
    }

    set timeout(timeout: ConfigurableTestObjectData["timeout"]) {
        this.#data.timeout = timeout;
    }

    get timeout(): ConfigurableTestObjectData["timeout"] {
        return this.#getInheritedProperty<ConfigurableTestObjectData["timeout"]>("timeout", 0);
    }

    set browserId(id: string) {
        this.#data.browserId = id;
    }

    get browserId(): ConfigurableTestObjectData["browserId"] {
        return this.#getInheritedProperty<ConfigurableTestObjectData["browserId"]>("browserId", "");
    }

    set browserVersion(version: string) {
        this.#data.browserVersion = version;
    }

    get browserVersion(): ConfigurableTestObjectData["browserVersion"] {
        return this.#getInheritedProperty<ConfigurableTestObjectData["browserVersion"]>("browserVersion", undefined);
    }

    get hasBrowserVersionOverwritten(): boolean {
        return "browserVersion" in this.#data;
    }

    #getInheritedProperty<T>(name: keyof ConfigurableTestObjectData, defaultValue: T): T {
        return name in this.#data ? (this.#data[name] as T) : (_.get(this.parent, name, defaultValue) as T);
    }
}
