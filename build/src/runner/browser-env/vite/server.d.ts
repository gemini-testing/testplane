import { Config } from "../../../config";
export declare class ViteServer {
    private _testplaneConfig;
    private _viteConfig;
    private _options?;
    private _server?;
    static create<T extends ViteServer>(this: new (testplaneConfig: Config) => T, testplaneConfig: Config): T;
    constructor(testplaneConfig: Config);
    start(): Promise<void>;
    close(): Promise<void>;
    private _applyUserViteConfig;
    private _addRequiredVitePlugins;
    get baseUrl(): string | undefined;
}
