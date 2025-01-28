import type { UserConfig, ConfigEnv } from "vite";
import type { BrowserViteEvents, WorkerViteEvents, ViteBrowserEvents } from "./browser-modules/types";
export type { BrowserViteEvents, WorkerViteEvents } from "./browser-modules/types";
export interface BrowserTestRunEnvOptions {
    /**
     * Vite configuration
     */
    viteConfig?: string | UserConfig | ((env: ConfigEnv) => UserConfig | Promise<UserConfig>);
    /**
     * If set to `true` Testplane will automatically mock dependencies within the `automockDir` directory
     * @default false
     */
    automock?: boolean;
    /**
     * Path to automock directory in which Testplane will look for dependencies to mock
     * @default ./__mocks__
     */
    automockDir?: string;
}
export interface ClientViteEvents extends BrowserViteEvents, WorkerViteEvents {
}
export interface ViteClientEvents extends BrowserViteEvents, ViteBrowserEvents {
}
export declare enum BrowserEventNames {
    initialize = "browser:initialize",
    runBrowserCommand = "browser:runBrowserCommand",
    runExpectMatcher = "browser:runExpectMatcher",
    callConsoleMethod = "browser:callConsoleMethod",
    reconnect = "browser:reconnect"
}
