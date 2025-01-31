import path from "path";
import fs from "fs";
import { ClientBridge } from "./client-bridge";
import {ExistingBrowser} from "../existing-browser";

const bundlesCache: Record<string, string> = {};

export { ClientBridge };

export const build = async (
    browser: ExistingBrowser,
    opts: { calibration?: { needsCompatLib?: boolean } } = {}
): Promise<ClientBridge> => {
    const needsCompatLib = opts.calibration?.needsCompatLib ?? false;
    const scriptFileName = needsCompatLib ? "bundle.compat.js" : "bundle.native.js";

    if (bundlesCache[scriptFileName]) {
        return ClientBridge.create(browser, bundlesCache[scriptFileName]);
    }

    const scriptFilePath = path.join(__dirname, "..", "client-scripts", scriptFileName);
    const bundle = await fs.promises.readFile(scriptFilePath, { encoding: "utf8" });
    bundlesCache[scriptFileName] = bundle;

    return ClientBridge.create(browser, bundle);
};
