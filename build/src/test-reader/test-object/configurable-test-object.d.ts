import { TestObject } from "./test-object";
import type { ConfigurableTestObjectData, TestObjectData } from "./types";
type ConfigurableTestObjectOpts = Pick<ConfigurableTestObjectData, "file" | "id" | "location"> & TestObjectData;
type SkipData = {
    reason: string;
};
export declare class ConfigurableTestObject extends TestObject {
    #private;
    constructor({ title, file, id, location }: ConfigurableTestObjectOpts);
    assign(src: this): this;
    skip({ reason }: SkipData): void;
    disable(): void;
    enable(): void;
    get id(): ConfigurableTestObjectData["id"];
    get file(): ConfigurableTestObjectData["file"];
    set pending(val: ConfigurableTestObjectData["pending"]);
    get pending(): ConfigurableTestObjectData["pending"];
    set skipReason(reason: ConfigurableTestObjectData["skipReason"]);
    get skipReason(): ConfigurableTestObjectData["skipReason"];
    set disabled(val: ConfigurableTestObjectData["disabled"]);
    get disabled(): ConfigurableTestObjectData["disabled"];
    set silentSkip(val: ConfigurableTestObjectData["silentSkip"]);
    get silentSkip(): ConfigurableTestObjectData["silentSkip"];
    set timeout(timeout: ConfigurableTestObjectData["timeout"]);
    get timeout(): ConfigurableTestObjectData["timeout"];
    set browserId(id: string);
    get browserId(): ConfigurableTestObjectData["browserId"];
    set browserVersion(version: string);
    get browserVersion(): ConfigurableTestObjectData["browserVersion"];
    get hasBrowserVersionOverwritten(): boolean;
    get location(): ConfigurableTestObjectData["location"];
}
export {};
