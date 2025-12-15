import fs from "fs-extra";

import { restoreStorage } from "./restoreStorage";

import * as logger from "../../../utils/logger";
import type { Browser } from "../../types";
import { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } from "../../../constants/config";
import { getOverridesProtocol, getWebdriverFrames, SaveStateData } from "../saveState";
import { getActivePuppeteerPage } from "../../existing-browser";
import { Cookie } from "@testplane/wdio-protocols";
import { StateOpts } from "../../../config/types";

export type RestoreStateOptions = Omit<StateOpts, "keepFile"> & {
    data?: SaveStateData;
    refresh?: boolean;
};

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("restoreState", async (_options: RestoreStateOptions) => {
        const currentUrl = new URL(await session.getUrl());

        if (!currentUrl.origin || currentUrl.origin === "null") {
            logger.error("Before restoreState first open page using url command");
            process.exit(1);
        }

        const options = { ...browser.config.stateOpts, refresh: true, ..._options };

        let restoreState: SaveStateData | undefined = options.data;

        if (options.path) {
            restoreState = await fs.readJson(options.path);
        }

        if (!restoreState) {
            logger.error("Can't restore state: please provide a path to file or data");
            process.exit(1);
        }

        if (restoreState?.cookies && options.cookieFilter) {
            restoreState.cookies = restoreState?.cookies.filter(options.cookieFilter);
        }

        switch (getOverridesProtocol(browser)) {
            case WEBDRIVER_PROTOCOL: {
                await session.switchToParentFrame();

                if (restoreState.cookies && options.cookies) {
                    await session.setCookies(
                        restoreState.cookies.map(
                            cookie =>
                                ({
                                    ...cookie,
                                    secure: cookie.secure || cookie.sameSite === "None", // fix for ff
                                    sameSite:
                                        cookie.sameSite && session.isBidi
                                            ? cookie.sameSite.toLowerCase()
                                            : cookie.sameSite,
                                } as Cookie),
                        ),
                    );
                }

                if (restoreState.framesData) {
                    await session.switchToParentFrame();

                    const frames = await getWebdriverFrames(session);

                    for (let i = 0; i <= frames.length; i++) {
                        await session.switchToParentFrame();

                        // after last element have to set data for parent frame
                        if (i < frames.length) {
                            await session.switchFrame(await session.$(`iframe[src="${frames[i]}"]`));
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
                        }
                    }

                    await session.switchToParentFrame();
                }

                if (options.refresh) {
                    await session.refresh();
                }

                break;
            }
            case DEVTOOLS_PROTOCOL: {
                const page = await getActivePuppeteerPage(session);

                if (!page) {
                    return;
                }

                const frames = page.frames();

                if (restoreState.cookies && options.cookies) {
                    await page.setCookie(...restoreState.cookies);
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
                }

                if (options.refresh) {
                    await page.reload();
                }

                break;
            }
        }
    });
};
