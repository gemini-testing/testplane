export class Test extends ConfigurableTestObject {
    constructor({ title, file, id, fn }: {
        title: any;
        file: any;
        id: any;
        fn: any;
    });
    fn: any;
    clone(): any;
}
import { ConfigurableTestObject } from "./configurable-test-object";
