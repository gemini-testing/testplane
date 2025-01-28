/// <reference types="node" />
import { EventEmitter } from "events";
import { Config } from "../config";
import { Test } from "./test-object";
import { ReadTestsOpts } from "../testplane";
export type TestReaderOpts = {
    paths: string[];
} & Partial<ReadTestsOpts>;
export declare class TestReader extends EventEmitter {
    #private;
    static create<T extends TestReader>(this: new (...args: any[]) => T, ...args: ConstructorParameters<typeof TestReader>): T;
    constructor(config: Config);
    read(options: TestReaderOpts): Promise<Record<string, Test[]>>;
}
