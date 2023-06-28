export class ConfigurableTestObject extends TestObject {
    constructor({ title, file, id }: {
        title: any;
        file: any;
        id: any;
    });
    skip({ reason }: {
        reason: any;
    }): void;
    set pending(arg: any);
    get pending(): any;
    set skipReason(arg: any);
    get skipReason(): any;
    disable(): void;
    set disabled(arg: any);
    get disabled(): any;
    set silentSkip(arg: any);
    get silentSkip(): any;
    get id(): any;
    get file(): any;
    set timeout(arg: any);
    get timeout(): any;
    set browserId(arg: any);
    get browserId(): any;
    set browserVersion(arg: any);
    get browserVersion(): any;
    get hasBrowserVersionOverwritten(): boolean;
    #private;
}
import { TestObject } from "./test-object";
