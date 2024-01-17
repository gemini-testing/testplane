export = Config;
declare class Config {
    static create(config: any): import(".");
    static read(configPath: any): any;
    constructor(config: any);
    configPath: string | undefined;
    browsers: _.NumericDictionary<BrowserConfig>;
    forBrowser(id: any): BrowserConfig;
    getBrowserIds(): string[];
    serialize(): import(".") & {
        browsers: {
            [x: number]: Partial<BrowserConfig>;
        };
    };
    /**
     * This method is used in subrocesses to merge a created config
     * in a subrocess with a config from the main process
     */
    mergeWith(config: any): void;
}
import BrowserConfig = require("./browser-config");
import _ = require("lodash");
