import { fetchChromiumMilestoneVersions } from "./chromium";
import { fetchChromeMilestoneVersions } from "./chrome";
import { fetchFirefoxMilestoneVersions } from "./firefox";
import type { BrowserWithVersion } from "../utils";
import type { SupportedBrowser } from "../../../utils";
import { BrowserName } from "../../../../browser/types";

export const fetchBrowsersMilestones = async (): Promise<BrowserWithVersion[]> => {
    const createMapToBrowser = (browserName: SupportedBrowser) => (data: string[]) =>
        data.map(browserVersion => ({ browserName, browserVersion }));

    const [chromiumVersions, chromeVersions, firefoxVersions] = await Promise.all([
        fetchChromiumMilestoneVersions().then(createMapToBrowser(BrowserName.CHROME)),
        fetchChromeMilestoneVersions().then(createMapToBrowser(BrowserName.CHROME)),
        fetchFirefoxMilestoneVersions().then(createMapToBrowser(BrowserName.FIREFOX)),
    ]);

    return [...chromiumVersions, ...chromeVersions, ...firefoxVersions];
};
