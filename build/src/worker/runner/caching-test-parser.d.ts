/// <reference types="node" />
import { EventEmitter } from "events";
import { Config } from "../../config";
import { Test } from "../../types";
export type CacheKey = {
    file: string;
    browserId: string;
};
export type ParseArgs = {
    file: string;
    browserId: string;
};
export declare class CachingTestParser extends EventEmitter {
    private _cache;
    private _sequenceTestParser;
    static create<T extends CachingTestParser>(this: new (...args: any[]) => T, ...args: ConstructorParameters<typeof CachingTestParser>): T;
    constructor(config: Config);
    parse({ file, browserId }: ParseArgs): Promise<Test[]>;
    private _getFromCache;
    private _putToCache;
}
