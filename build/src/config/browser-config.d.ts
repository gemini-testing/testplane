import type { Test } from "../types";
import type { CommonConfig } from "./types";
export declare class BrowserConfig {
    constructor(browserOptions: CommonConfig);
    getScreenshotPath(test: Test, stateName: string): string;
    serialize(): Omit<this, "system">;
}
