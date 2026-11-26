import * as path from "path";
import * as _ from "lodash";
import type { Test } from "../types";
import type { CommonConfig } from "./types";

export interface BrowserConfig extends CommonConfig {
    id: string;
}

export class BrowserConfig {
    constructor(browserOptions: CommonConfig & { id: string }) {
        _.extend(this, browserOptions);
    }

    getScreenshotPath(test: Test, stateName: string): string {
        const filename = `${stateName}.png`;
        const { screenshotsDir } = this;

        return _.isFunction(screenshotsDir)
            ? path.resolve(screenshotsDir(test), filename)
            : path.resolve(process.cwd(), screenshotsDir, test.id, this.id, filename);
    }

    serialize(): Omit<this, "system"> {
        return _.omit(this, ["system"]);
    }
}
