export = AsyncEmitter;
declare class AsyncEmitter extends EventEmitter {
    emitAndWait(event: any, ...args: any[]): Promise<any>;
}
import { EventEmitter } from "events";
