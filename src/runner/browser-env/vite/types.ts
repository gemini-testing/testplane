import { BROWSER_EVENT_SUFFIX } from "./constants";
import type { InlineConfig, ConfigEnv } from "vite";
import type { BrowserViteEvents, WorkerViteEvents, ViteBrowserEvents } from "./browser-modules/types";

export type { BrowserViteEvents, WorkerViteEvents } from "./browser-modules/types";

export interface BrowserTestRunEnvOptions {
    viteConfig?: string | InlineConfig | ((env: ConfigEnv) => InlineConfig | Promise<InlineConfig>);
}

export interface ClientViteEvents extends BrowserViteEvents, WorkerViteEvents {}
export interface ViteClientEvents extends BrowserViteEvents, ViteBrowserEvents {}

// TODO: use from "./browser-modules/types" after migrate to esm
export enum BrowserEventNames {
    initialize = `${BROWSER_EVENT_SUFFIX}:initialize`,
}
