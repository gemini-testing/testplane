/// <reference types="node" />
import { EventEmitter } from "events";
export declare class AlsoController {
    #private;
    static create<T extends AlsoController>(this: new (eventBus: EventEmitter) => T, eventBus: EventEmitter): T;
    constructor(eventBus: EventEmitter);
    in(matchers: string | RegExp | Array<string | RegExp>): this;
}
