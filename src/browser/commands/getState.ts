import fs from "fs-extra";

import type { Browser } from "../types";
import type { SaveStateData } from "./saveState";
import type { StateOpts } from "../../config/types";
import * as logger from "../../utils/logger";

export type GetStateOptions = Pick<StateOpts, "path">;

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand(
        "getState",
        async (options: GetStateOptions = browser.config.stateOpts || {}): Promise<SaveStateData | null> => {
            if (options.path) {
                return fs.readJson(options.path);
            }

            logger.error("Please provide the path to the state file for getState");

            return null;
        },
    );
};
