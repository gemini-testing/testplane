import { launchBrowser } from "../../../src/browser/standalone";
import { BROWSER_CONFIG } from "./constants";

exports.mochaGlobalSetup = async function (): Promise<void> {
    // Here we trigger downloading browsers before running tests
    const browser = await launchBrowser(BROWSER_CONFIG);
    await browser.deleteSession();
};
