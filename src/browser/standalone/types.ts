import type { CommonConfig, SystemConfig } from "../../config/types";

export type StandaloneBrowserOptions = Pick<
    CommonConfig,
    | "automationProtocol"
    | "desiredCapabilities"
    | "gridUrl"
    | "baseUrl"
    | "httpTimeout"
    | "pageLoadTimeout"
    | "waitTimeout"
    | "waitInterval"
    | "headless"
    | "prepareBrowser"
    | "windowSize"
    | "orientation"
    | "headers"
    | "strictSSL"
    | "user"
    | "key"
    | "system"
>;

export type StandaloneBrowserOptionsInput = Partial<Omit<StandaloneBrowserOptions, "system">> & {
    system?: Partial<SystemConfig>;
};
