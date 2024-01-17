export class ConfigurableTestObject extends TestObject {
    constructor({ title, file, id }: {
        title: any;
        file: any;
        id: any;
    });
    skip({ reason }: {
        reason: any;
    }): void;
    set pending(val: any);
    get pending(): any;
    set skipReason(reason: any);
    get skipReason(): any;
    disable(): void;
    set disabled(val: any);
    get disabled(): any;
    set silentSkip(val: any);
    get silentSkip(): any;
    get id(): any;
    get file(): any;
    set timeout(timeout: any);
    get timeout(): any;
    set browserId(id: any);
    get browserId(): any;
    set browserVersion(version: any);
    get browserVersion(): any;
    get hasBrowserVersionOverwritten(): boolean;
    #private;
}
import { TestObject } from "./test-object";
