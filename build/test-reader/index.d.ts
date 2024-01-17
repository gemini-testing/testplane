export = TestReader;
declare class TestReader extends EventEmitter {
    static create(...args: any[]): import(".");
    constructor(config: any);
    read(options?: {}): Promise<any>;
    #private;
}
import { EventEmitter } from "events";
