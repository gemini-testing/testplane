/// <reference types="node" />
import { EventEmitter } from "events";
export declare class AsyncEmitter extends EventEmitter {
    emitAndWait(event: string | symbol, ...args: unknown[]): Promise<unknown[]>;
}
