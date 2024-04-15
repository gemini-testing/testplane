import { HERMIONE_BROWSER_EVENT_SUFFIX } from "./constants";
import type { InlineConfig, ConfigEnv } from "vite";
import type { BrowserMessageEvents } from "./browser-modules/types";

export interface BrowserTestRunEnvOptions {
    viteConfig?: string | InlineConfig | ((env: ConfigEnv) => InlineConfig | Promise<InlineConfig>);
    preset?: "react"
}

export interface VitePluginOptions extends BrowserTestRunEnvOptions {
    modulePaths: {
        mocha: string;
        webdriverio: string;
    };
}

// TODO: use from "./browser-modules/types" after migrate to esm
export enum BrowserEventNames {
    init = `${HERMIONE_BROWSER_EVENT_SUFFIX}:init`,
    runnableResult = `${HERMIONE_BROWSER_EVENT_SUFFIX}:runnableResult`,
    runCommand = `${HERMIONE_BROWSER_EVENT_SUFFIX}:runCommand`,
    runExpectMatcher = `${HERMIONE_BROWSER_EVENT_SUFFIX}:runExpectMatcher`,
}

export type BrowserPayloadByEvent<T extends BrowserEventNames> = {
    event: T,
    type: "custom",
    data: BrowserMessageEvents[T];
}
export type BrowserPayload = BrowserPayloadByEvent<BrowserEventNames>;

export { BrowserMessageEvents, BrowserInitMessage, BrowserRunnableResultMessage, BrowserRunCommandMessage, BrowserMessageByEvent, BrowserMessage } from "./browser-modules/types";
