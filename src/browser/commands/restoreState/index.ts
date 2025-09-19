import fs from "fs-extra";

import { clearAllIndexedDB } from "./clearAllIndexedDB";
import { restoreIndexedDB } from "./restoreIndexedDB";
import { restoreStorage } from "./restoreStorage";
import * as logger from "../../../utils/logger";

import type { Browser } from "../../types";

type RestoreStateOptions = {
    path: string,
}

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand(
        "restoreState",
        async (options: RestoreStateOptions) => {
            const restoreState = await fs.readJson(options.path);

            const puppeteer = await session.getPuppeteer();
            const pages = await puppeteer.pages();
            const frames = pages[0].frames();

            for (const frame of frames) {
                const origin = new URL(frame.url()).origin;

                if (origin === "null" || !restoreState.framesData[origin]) {
                    continue;
                }

                logger.log("origin", origin);

                const frameData = restoreState.framesData[origin];

                if (frameData.localStorage) {
                    logger.log("restoreState localStorage");

                    await frame.evaluate(
                        restoreStorage,
                        frameData.localStorage as Record<string, string>,
                        "localStorage" as const
                    );
                }

                if (frameData.sessionStorage) {
                    logger.log("restoreState sessionStorage");

                    await frame.evaluate(
                        restoreStorage,
                        frameData.sessionStorage as Record<string, string>,
                        "sessionStorage" as const
                    );
                }

                if (frameData.indexDB) {
                    logger.log("clear indexDB");

                    await frame.evaluate(clearAllIndexedDB);
                    logger.log("restoreState indexDB");
                    await frame.evaluate(restoreIndexedDB, frameData.indexDB);
                }

                logger.log("done with ", origin);
            }
        }
    );
};
