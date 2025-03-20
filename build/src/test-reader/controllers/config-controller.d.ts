/// <reference types="node" />
import { EventEmitter } from "events";
export declare class ConfigController {
    #private;
    static create<T extends ConfigController>(this: new (eventBus: EventEmitter) => T, eventBus: EventEmitter): T;
    constructor(eventBus: EventEmitter);
    testTimeout(timeout: number): this;
}
