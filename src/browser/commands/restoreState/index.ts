import fs from "fs-extra";
import _ from "lodash";

// import { clearAllIndexedDB } from "./clearAllIndexedDB";
// import { restoreIndexedDB } from "./restoreIndexedDB";
import { restoreStorage } from "./restoreStorage";

import * as logger from "../../../utils/logger";
import type { Browser } from "../../types";
import { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } from "../../../constants/config";
import { defaultOptions, getWebdriverFrames, SaveStateData, SaveStateOptions } from "../saveState";
import { Protocol } from "devtools-protocol";

export type RestoreStateOptions = SaveStateOptions & {
    data?: SaveStateData;
};

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("restoreState", async (_options: RestoreStateOptions) => {
        const options = { ...defaultOptions, ..._options };

        let restoreState: SaveStateData | undefined = options.data;

        if (options.path) {
            restoreState = await fs.readJson(options.path);
        }

        if (!restoreState) {
            logger.error("Can't restore state: please provide a path to file or data");
            return;
        }

        switch (browser.config.automationProtocol) {
            case WEBDRIVER_PROTOCOL: {
                if (restoreState.cookies && options.cookies) {
                    await session.setCookies(restoreState.cookies);
                }

                if (restoreState.framesData) {
                    await session.switchToParentFrame();

                    const frames = await getWebdriverFrames(session);

                    for (let i = -1; i < frames.length; i++) {
                        await session.switchToParentFrame();

                        // start with -1 for get data from main page
                        if (i > -1) {
                            await session.switchFrame(frames[i]);
                        }

                        const origin = await session.execute<string, []>(() => window.location.origin);

                        const frameData = restoreState.framesData[origin];

                        if (frameData) {
                            if (frameData.localStorage && options.localStorage) {
                                await session.execute<void, [Record<string, string>, "localStorage"]>(
                                    restoreStorage,
                                    frameData.localStorage,
                                    "localStorage",
                                );
                            }

                            if (frameData.sessionStorage && options.sessionStorage) {
                                await session.execute<void, [Record<string, string>, "sessionStorage"]>(
                                    restoreStorage,
                                    frameData.sessionStorage,
                                    "sessionStorage",
                                );
                            }

                            // @TODO: will make it later
                            // if (frameData.indexDB && options.indexDB) {
                            //     // @todo: Doesn't work now
                            //     await session.execute(clearAllIndexedDB);
                            //     await session.execute(restoreIndexedDB, frameData.indexDB);
                            // }
                        }
                    }

                    await session.switchToParentFrame();
                }

                break;
            }
            case DEVTOOLS_PROTOCOL: {
                const puppeteer = await session.getPuppeteer();
                const pages = await puppeteer.pages();
                const page = pages[0];
                const frames = page.frames();

                if (restoreState.cookies && options.cookies) {
                    await page.setCookie(
                        ...restoreState.cookies.map(cookie => ({
                            ...cookie,
                            sameSite: _.startCase(_.toLower(cookie.sameSite)) as Protocol.Network.CookieSameSite,
                        })),
                    );
                }

                for (const frame of frames) {
                    const origin = new URL(frame.url()).origin;

                    if (origin === "null" || !restoreState.framesData[origin]) {
                        continue;
                    }

                    const frameData = restoreState.framesData[origin];

                    if (!frameData) {
                        continue;
                    }

                    if (frameData.localStorage && options.localStorage) {
                        await frame.evaluate(
                            restoreStorage,
                            frameData.localStorage as Record<string, string>,
                            "localStorage" as const,
                        );
                    }

                    if (frameData.sessionStorage && options.sessionStorage) {
                        await frame.evaluate(
                            restoreStorage,
                            frameData.sessionStorage as Record<string, string>,
                            "sessionStorage" as const,
                        );
                    }

                    // @TODO: will make it later
                    // if (frameData.indexDB) {
                    //     // @todo: Doesn't work now
                    //     await frame.evaluate(clearAllIndexedDB);
                    //     await frame.evaluate(restoreIndexedDB, frameData.indexDB);
                    // }
                }
                break;
            }
        }
    });
};
