import { fetchChromiumMilestoneVersions } from "./chromium";
import { fetchChromeMilestoneVersions } from "./chrome";
import { fetchFirefoxMilestoneVersions } from "./firefox";
import type { BrowserWithVersion } from "../utils";

export const fetchBrowsersMilestones = async (): Promise<BrowserWithVersion[]> => {
    const createMapToBrowser = (browserName: string) => (data: string[]) =>
        data.map(browserVersion => ({ browserName, browserVersion }));

    const [chromiumVersions, chromeVersions, firefoxVersions] = await Promise.all([
        fetchChromiumMilestoneVersions().then(createMapToBrowser("chrome")),
        fetchChromeMilestoneVersions().then(createMapToBrowser("chrome")),
        fetchFirefoxMilestoneVersions().then(createMapToBrowser("firefox")),
    ]);

    return [...chromiumVersions, ...chromeVersions, ...firefoxVersions];
};
