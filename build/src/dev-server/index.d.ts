import { Config } from "../config";
import type { Testplane } from "../testplane";
export type DevServerOpts = {
    testplane: Testplane;
    devServerConfig: Config["devServer"];
    configPath: string;
};
export type InitDevServer = (opts: DevServerOpts) => Promise<void>;
export declare const initDevServer: InitDevServer;
