/// <reference types="node" />
import { EventEmitter } from "events";
export declare class BrowserVersionController {
    #private;
    static create<T extends BrowserVersionController>(this: new (browserId: string, eventBug: EventEmitter) => T, browserId: string, eventBug: EventEmitter): T;
    constructor(browserId: string, eventBus: EventEmitter);
    version(browserVersion: string): this;
}
export declare function mkProvider(knownBrowsers: string[], eventBus: EventEmitter): (browserId: string) => BrowserVersionController;
