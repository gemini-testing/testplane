/// <reference types="node" />
import { EventEmitter } from "events";
export declare class OnlyController {
    #private;
    static create<T extends OnlyController>(this: new (eventBus: EventEmitter) => T, eventBus: EventEmitter): T;
    constructor(eventBus: EventEmitter);
    in(matchers: string | RegExp | Array<string | RegExp>): this;
    notIn(matchers: string | RegExp | Array<string | RegExp>): this;
}
