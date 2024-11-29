import _ from "lodash";
import { getMilestone, retryFetch } from "../../browser-installer/utils";
import { FIREFOX_VERSIONS_API_URL } from "../constants";
import { MIN_FIREFOX_VERSION } from "../../browser-installer/constants";

type FirefoxVersionInfo = {
    category: "major" | "esr" | "stability" | "dev";
    date: `${number}-${number}-${number}`;
    version: string;
};

type FirefoxVersionsApiResponse = { releases: Record<string, FirefoxVersionInfo> };

export const fetchFirefoxMilestoneVersions = async (): Promise<string[]> => {
    try {
        const response = await retryFetch(FIREFOX_VERSIONS_API_URL);
        const data = (await response.json()) as FirefoxVersionsApiResponse;
        const stableVersions = Object.values(data.releases)
            .filter(data => ["stability", "esr"].includes(data.category))
            .filter(data => Number(getMilestone(data.version)) >= MIN_FIREFOX_VERSION);

        const majorGrouped = _.groupBy(stableVersions, data => data.version.split(".")[0]);

        return Object.keys(majorGrouped).map(groupName => {
            const versionsSorted = majorGrouped[groupName].sort((a, b) => {
                return parseInt(a.version.replace(".", ""), 16) - parseInt(b.version.replace(".", ""), 16);
            });

            return versionsSorted.pop()?.version as string;
        });
    } catch (err) {
        throw new Error(`Couldn't get firefox versions: ${err}`);
    }
};
