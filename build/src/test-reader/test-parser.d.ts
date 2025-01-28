/// <reference types="node" />
import { EventEmitter } from "events";
import { Test } from "./test-object";
import { Config } from "../config";
import { BrowserConfig } from "../config/browser-config";
import type { ReadTestsOpts } from "../testplane";
export type TestParserOpts = {
    testRunEnv?: "nodejs" | "browser";
};
export type TestParserParseOpts = {
    browserId: string;
    grep?: RegExp;
    config: BrowserConfig;
};
type LoadFilesOpts = {
    config: Config;
    runnableOpts?: ReadTestsOpts["runnableOpts"];
};
export declare class TestParser extends EventEmitter {
    #private;
    constructor(opts?: TestParserOpts);
    loadFiles(files: string[], { config, runnableOpts }: LoadFilesOpts): Promise<void>;
    parse(files: string[], { browserId, config, grep }: TestParserParseOpts): Test[];
}
export {};
