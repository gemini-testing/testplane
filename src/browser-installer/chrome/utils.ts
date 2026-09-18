import {
    CHROME_FOR_TESTING_LATEST_RELEASE_FILENAME_PREFIX,
    CHROME_FOR_TESTING_MILESTONES_FILENAME,
    CHROME_FOR_TESTING_PATCH_VERSIONS_FILENAME,
} from "../constants";
import { getBrowserDownloadMirrorFileUrl } from "../mirrors";
import { retryFetch } from "../utils";

type ChromeVersionsResponse = {
    milestones?: Record<string, { version: string }>;
    builds?: Record<string, { version: string }>;
};

export type ChromeBuildIdResolver = () => Promise<string>;

const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;
const MILESTONE_VERSION_PATTERN = /^\d+(?:\.\d+)?$/;
const BUILD_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const CHANNELS = new Set(["stable", "beta", "dev", "canary", "latest"]);

const createResolutionError = (selector: string): Error =>
    new Error(`Couldn't resolve Chrome-for-Testing build ID for selector '${selector}' from the configured mirror`);

export const resolveChromeBuildIdFromMirror = async (version: string, mirror: string): Promise<string> => {
    const selector = version.trim();

    if (EXACT_VERSION_PATTERN.test(selector)) {
        return selector;
    }

    const isChannel = CHANNELS.has(selector);
    const isMilestone = MILESTONE_VERSION_PATTERN.test(selector);
    let filename: string;

    if (isChannel) {
        const channel = selector === "latest" ? "canary" : selector;

        filename = `${CHROME_FOR_TESTING_LATEST_RELEASE_FILENAME_PREFIX}${channel.toUpperCase()}`;
    } else if (isMilestone) {
        filename = CHROME_FOR_TESTING_MILESTONES_FILENAME;
    } else if (BUILD_VERSION_PATTERN.test(selector)) {
        filename = CHROME_FOR_TESTING_PATCH_VERSIONS_FILENAME;
    } else {
        throw createResolutionError(selector);
    }

    const response = await retryFetch(getBrowserDownloadMirrorFileUrl(mirror, filename));

    if (!response.ok) {
        throw createResolutionError(selector);
    }

    let buildId: unknown;

    if (isChannel) {
        buildId = await response.text();
    } else {
        const data = (await response.json()) as ChromeVersionsResponse | null;

        buildId = isMilestone ? data?.milestones?.[selector.split(".")[0]]?.version : data?.builds?.[selector]?.version;
    }

    const resolvedVersion = typeof buildId === "string" ? buildId.trim() : "";

    if (!EXACT_VERSION_PATTERN.test(resolvedVersion) || (!isChannel && !resolvedVersion.startsWith(`${selector}.`))) {
        throw createResolutionError(selector);
    }

    return resolvedVersion;
};
