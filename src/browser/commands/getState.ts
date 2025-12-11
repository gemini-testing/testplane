import fs from "fs-extra";

import type { Browser } from "../types";
import { SaveStateData, SaveStateOptions } from "./saveState";

export type GetStateOptions = Required<Pick<SaveStateOptions, "path">>;

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("getState", async ({ path }: GetStateOptions): Promise<SaveStateData> => fs.readJson(path));
};
