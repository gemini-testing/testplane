import { getBrowserPlatform } from "../../../utils";

export const fetchChromiumMilestoneVersions = async (): Promise<string[]> => {
    try {
        const platform = getBrowserPlatform();

        const { default: versions } = await import(`../../browser-installer/chromium/revisions/${platform}`);

        return Object.keys(versions);
    } catch (err) {
        throw new Error(`Couldn't get chromium versions: ${err}`);
    }
};
