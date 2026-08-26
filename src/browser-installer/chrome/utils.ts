import {
    CHROME_FOR_TESTING_LATEST_RELEASE_FILENAME_PREFIX,
    CHROME_FOR_TESTING_MILESTONES_FILENAME,
    CHROME_FOR_TESTING_PATCH_VERSIONS_FILENAME,
} from "../constants";
import { getBrowserDownloadMirrorFileUrl } from "../mirrors";
import { retryFetch } from "../utils";

type ChromeMilestonesApiResponse = {
    milestones?: Record<string, { version: string }>;
};

type ChromeBuildsApiResponse = {
    builds?: Record<string, { version: string }>;
};

export type ChromeBuildIdResolver = (mirror: string) => Promise<string>;

const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;
const MILESTONE_VERSION_PATTERN = /^\d+(?:\.\d+)?$/;
const BUILD_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const CHANNELS = new Set(["stable", "beta", "dev", "canary", "latest"]);

const createResolutionError = (version: string): Error =>
    new Error(`Couldn't resolve Chrome-for-Testing build ID for selector '${version}' from the configured mirror`);

const validateResolvedBuildId = (buildId: string | undefined, version: string): string => {
    const trimmedBuildId = buildId?.trim();

    if (!trimmedBuildId || !EXACT_VERSION_PATTERN.test(trimmedBuildId)) {
        throw createResolutionError(version);
    }

    return trimmedBuildId;
};

export const resolveChromeBuildIdFromMirror = async (version: string, mirror: string): Promise<string> => {
    const selector = version.trim();

    if (EXACT_VERSION_PATTERN.test(selector)) {
        return selector;
    }

    if (!CHANNELS.has(selector) && !MILESTONE_VERSION_PATTERN.test(selector) && !BUILD_VERSION_PATTERN.test(selector)) {
        throw createResolutionError(version);
    }

    try {
        if (CHANNELS.has(selector)) {
            const channel = selector === "latest" ? "canary" : selector;
            const filename = `${CHROME_FOR_TESTING_LATEST_RELEASE_FILENAME_PREFIX}${channel.toUpperCase()}`;
            const response = await retryFetch(getBrowserDownloadMirrorFileUrl(mirror, filename));
            const buildId = await response.text();

            return validateResolvedBuildId(buildId, version);
        }

        if (MILESTONE_VERSION_PATTERN.test(selector)) {
            const milestone = selector.split(".")[0];
            const response = await retryFetch(
                getBrowserDownloadMirrorFileUrl(mirror, CHROME_FOR_TESTING_MILESTONES_FILENAME),
            );
            const data = (await response.json()) as ChromeMilestonesApiResponse | null;
            const buildId = validateResolvedBuildId(data?.milestones?.[milestone]?.version, version);

            if (!buildId.startsWith(`${selector}.`)) {
                throw createResolutionError(version);
            }

            return buildId;
        }

        const response = await retryFetch(
            getBrowserDownloadMirrorFileUrl(mirror, CHROME_FOR_TESTING_PATCH_VERSIONS_FILENAME),
        );
        const data = (await response.json()) as ChromeBuildsApiResponse | null;
        const buildId = validateResolvedBuildId(data?.builds?.[selector]?.version, version);

        if (!buildId.startsWith(`${selector}.`)) {
            throw createResolutionError(version);
        }

        return buildId;
    } catch {
        throw createResolutionError(version);
    }
};
