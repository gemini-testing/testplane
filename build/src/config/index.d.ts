import { BrowserConfig } from "./browser-config";
import { ConfigInput } from "./types";
export declare class Config {
    configPath: string;
    static create(config?: string | ConfigInput): Config;
    static read(configPath: string): unknown;
    constructor(config?: string | ConfigInput);
    forBrowser(id: string): BrowserConfig;
    getBrowserIds(): Array<string>;
    serialize(): Omit<Config, "system">;
    /**
     * This method is used in subrocesses to merge a created config
     * in a subrocess with a config from the main process
     */
    mergeWith(config: Config): void;
}
