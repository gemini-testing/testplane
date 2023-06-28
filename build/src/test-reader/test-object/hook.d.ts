export class Hook extends TestObject {
    constructor({ title, fn }: {
        title: any;
        fn: any;
    });
    fn: any;
    clone(): any;
    get file(): any;
    get timeout(): any;
    get browserId(): any;
}
import { TestObject } from "./test-object";
