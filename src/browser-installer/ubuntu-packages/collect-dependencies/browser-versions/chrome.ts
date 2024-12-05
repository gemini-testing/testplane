import { retryFetch } from "../../../utils";
import { CHROME_FOR_TESTING_VERSIONS_API_URL } from "../constants";

type ChromeVersionInfo = {
    milestone: `${number}`;
    version: `${number}.${number}.${number}.${number}`;
    revision: `${number}`;
};

type ChromeVersionsApiResponse = { milestones: Record<`${number}`, ChromeVersionInfo> };

export const fetchChromeMilestoneVersions = async (): Promise<string[]> => {
    try {
        const response = await retryFetch(CHROME_FOR_TESTING_VERSIONS_API_URL);
        const data = (await response.json()) as ChromeVersionsApiResponse;
        return Object.values(data.milestones).map(({ version }) => version);
    } catch (err) {
        throw new Error(`Couldn't get chrome versions: ${err}`);
    }
};
