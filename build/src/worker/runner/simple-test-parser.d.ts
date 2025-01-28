/// <reference types="node" />
import { Config } from "../../config";
import { EventEmitter } from "events";
import { Test } from "../../types";
export type ParseArgs = {
    file: string;
    browserId: string;
};
export declare class SimpleTestParser extends EventEmitter {
    private _config;
    static create<T extends SimpleTestParser>(this: new (...args: any[]) => T, ...args: ConstructorParameters<typeof SimpleTestParser>): T;
    constructor(config: Config);
    parse({ file, browserId }: ParseArgs): Promise<Test[]>;
}
