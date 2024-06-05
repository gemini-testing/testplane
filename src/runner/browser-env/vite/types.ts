import { BROWSER_EVENT_PREFIX } from "./constants";
import type { UserConfig, ConfigEnv } from "vite";
import type { BrowserViteEvents, WorkerViteEvents, ViteBrowserEvents } from "./browser-modules/types";

export type { BrowserViteEvents, WorkerViteEvents } from "./browser-modules/types";

export interface BrowserTestRunEnvOptions {
    viteConfig?: string | UserConfig | ((env: ConfigEnv) => UserConfig | Promise<UserConfig>);
}

export interface ClientViteEvents extends BrowserViteEvents, WorkerViteEvents {}
export interface ViteClientEvents extends BrowserViteEvents, ViteBrowserEvents {}

// TODO: use from "./browser-modules/types" after migrate to esm
export enum BrowserEventNames {
    initialize = `${BROWSER_EVENT_PREFIX}:initialize`,
    runBrowserCommand = `${BROWSER_EVENT_PREFIX}:runBrowserCommand`,
    runExpectMatcher = `${BROWSER_EVENT_PREFIX}:runExpectMatcher`,
    callConsoleMethod = `${BROWSER_EVENT_PREFIX}:callConsoleMethod`,
    reconnect = `${BROWSER_EVENT_PREFIX}:reconnect`,
}
