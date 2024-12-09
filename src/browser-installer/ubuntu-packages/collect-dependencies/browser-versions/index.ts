import { fetchChromiumMilestoneVersions } from "./chromium";
import { fetchChromeMilestoneVersions } from "./chrome";
import { fetchFirefoxMilestoneVersions } from "./firefox";
import type { BrowserWithVersion } from "../utils";
import { Browser, type SupportedBrowser } from "../../../utils";

export const fetchBrowsersMilestones = async (): Promise<BrowserWithVersion[]> => {
    const createMapToBrowser = (browserName: SupportedBrowser) => (data: string[]) =>
        data.map(browserVersion => ({ browserName, browserVersion }));

    const [chromiumVersions, chromeVersions, firefoxVersions] = await Promise.all([
        fetchChromiumMilestoneVersions().then(createMapToBrowser(Browser.CHROME)),
        fetchChromeMilestoneVersions().then(createMapToBrowser(Browser.CHROME)),
        fetchFirefoxMilestoneVersions().then(createMapToBrowser(Browser.FIREFOX)),
    ]);

    return [...chromiumVersions, ...chromeVersions, ...firefoxVersions];
};
