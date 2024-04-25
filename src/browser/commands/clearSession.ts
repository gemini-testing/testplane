import type { Browser } from "../types";
import logger from "../../utils/logger";

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    const clearStorage = async (storageName: "localStorage" | "sessionStorage"): Promise<void> => {
        try {
            await session.execute(storageName => window[storageName].clear(), storageName);
        } catch (e) {
            const message = (e as Error).message || "";

            if (message.startsWith(`Failed to read the '${storageName}' property from 'Window'`)) {
                logger.warn(`Couldn't clear ${storageName}: ${message}`);
            } else {
                throw e;
            }
        }
    };

    session.addCommand("clearSession", async function (): Promise<void> {
        await session.deleteAllCookies();

        await clearStorage("localStorage");
        await clearStorage("sessionStorage");
    });
};
