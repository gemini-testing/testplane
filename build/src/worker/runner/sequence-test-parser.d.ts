/// <reference types="node" />
import { EventEmitter } from "events";
import { Config } from "../../config";
import { Test } from "../../test-reader/test-object";
export type ParseArgs = {
    file: string;
    browserId: string;
};
export declare class SequenceTestParser extends EventEmitter {
    private _parser;
    private _queue;
    static create<T extends SequenceTestParser>(this: new (...args: any[]) => T, ...args: ConstructorParameters<typeof SequenceTestParser>): T;
    constructor(config: Config);
    parse({ file, browserId }: ParseArgs): Promise<Test[]>;
}
