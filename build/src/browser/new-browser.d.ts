import URI from "urijs";
import type { Capabilities } from "@testplane/types";
import { Browser, BrowserOpts } from "./browser";
import { Config } from "../config";
import { BrowserConfig } from "../config/browser-config";
import { type W3CBrowserName } from "./types";
export type VendorSpecificCapabilityName = "goog:chromeOptions" | "moz:firefoxOptions" | "ms:edgeOptions";
export type HeadlessBrowserOptions = Partial<Record<W3CBrowserName, {
    capabilityName: VendorSpecificCapabilityName;
    getArgs: (headlessMode: BrowserConfig["headless"]) => string[];
}>>;
export declare class NewBrowser extends Browser {
    constructor(config: Config, opts: BrowserOpts);
    init(): Promise<NewBrowser>;
    reset(): Promise<void>;
    quit(): Promise<void>;
    protected _createSession(): Promise<WebdriverIO.Browser>;
    protected _setPageLoadTimeout(): Promise<void>;
    protected _isLocalGridUrl(): boolean;
    protected _getSessionOpts(): Promise<Capabilities.WebdriverIOConfig>;
    protected _extendCapabilities(config: BrowserConfig): Promise<WebdriverIO.Capabilities>;
    protected _addHeadlessCapability(headless: BrowserConfig["headless"], capabilities: WebdriverIO.Capabilities): WebdriverIO.Capabilities;
    protected _extendCapabilitiesByVersion(): WebdriverIO.Capabilities;
    protected _extendCapabilitiesByWebSocketUrl(capabilities: WebdriverIO.Capabilities): WebdriverIO.Capabilities;
    protected _getLocalWebdriverGridUrl(): Promise<string>;
    protected _applyLocalBrowserCapabilities(config: BrowserConfig, capabilities: WebdriverIO.Capabilities): Promise<WebdriverIO.Capabilities>;
    protected _getGridHost(url: URI): string;
    protected _getQueryParams(query: string): Record<string, string>;
}
