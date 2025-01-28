/// <reference types="node" />
import { EventEmitter } from "events";
interface SkipOpts {
    negate?: boolean;
    silent?: boolean;
}
export declare class SkipController {
    #private;
    static create<T extends SkipController>(this: new (eventBus: EventEmitter) => T, eventBus: EventEmitter): T;
    constructor(eventBus: EventEmitter);
    in(matchers: string | RegExp | Array<string | RegExp>, reason: string, { silent }?: SkipOpts): this;
    notIn(matchers: string | RegExp | Array<string | RegExp>, reason: string, { silent }?: SkipOpts): this;
}
export {};
