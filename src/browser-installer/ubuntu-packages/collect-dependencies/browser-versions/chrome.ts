import { CHROME_FOR_TESTING_MILESTONES_API_URL } from "../../../constants";
import { retryFetch } from "../../../utils";

type ChromeVersionInfo = {
    milestone: `${number}`;
    version: `${number}.${number}.${number}.${number}`;
    revision: `${number}`;
};

type ChromeMilestonesApiResponse = { milestones: Record<`${number}`, ChromeVersionInfo> };

export const fetchChromeMilestoneVersions = async (): Promise<string[]> => {
    try {
        const response = await retryFetch(CHROME_FOR_TESTING_MILESTONES_API_URL);

        const data = (await response.json()) as ChromeMilestonesApiResponse;

        return Object.values(data.milestones).map(({ version }) => version);
    } catch (err) {
        throw new Error(`Couldn't get chrome versions: ${err}`);
    }
};
