import fs from "fs-extra";

import _ from "lodash";
import { dumpStorage, StorageData } from "./dumpStorage";
import { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } from "../../../constants/config";
import { ExistingBrowser, getActivePuppeteerPage } from "../../existing-browser";
import * as logger from "../../../utils/logger";
import { Cookie } from "../../../types";
import type { Browser } from "../../types";
import { MasterEvents } from "../../../events";
import { StateOpts } from "../../../config/types";
import { addGlobalFileToRemove } from "../../../globalFilesToRemove";

export type FrameData = StorageData;

export type SaveStateData = {
    cookies?: Array<Cookie>;
    framesData: Record<string, FrameData>;
};

// in case when we use webdriver protocol, bidi and isolation
// we have to force change protocol to devtools, for use puppeteer,
// because we use it for create incognito window
export const getOverridesProtocol = (browser: Browser): typeof WEBDRIVER_PROTOCOL | typeof DEVTOOLS_PROTOCOL =>
    browser.config.automationProtocol === WEBDRIVER_PROTOCOL && browser.publicAPI.isBidi && browser.config.isolation
        ? DEVTOOLS_PROTOCOL
        : browser.config.automationProtocol;

export const getWebdriverFrames = async (session: WebdriverIO.Browser): Promise<string[]> =>
    session.execute<string[], []>(() =>
        Array.from(document.getElementsByTagName("iframe"))
            .map(el => el.getAttribute("src") as string)
            .filter(src => src !== null && src !== "about:blank"),
    );

export default (browser: ExistingBrowser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("saveState", async (_options: StateOpts = {}): Promise<SaveStateData | undefined> => {
        const currentUrl = new URL(await session.getUrl());

        if (!currentUrl.origin || currentUrl.origin === "null") {
            throw new Error("Before saveState first open page using url command");
        }

        const options = { ...browser.config.stateOpts, ..._options };

        const data: SaveStateData = {
            framesData: {},
        };

        switch (getOverridesProtocol(browser)) {
            case WEBDRIVER_PROTOCOL: {
                if (options.cookies) {
                    const cookies = await session.getAllCookies();

                    data.cookies = cookies.map(
                        cookie =>
                            ({
                                ...cookie,
                                sameSite: cookie.sameSite ? _.startCase(cookie.sameSite) : cookie.sameSite,
                            } as Cookie),
                    );
                }

                await session.switchToParentFrame();

                const frames = await getWebdriverFrames(session);
                const framesData: Record<string, FrameData> = {};

                for (let i = 0; i <= frames.length; i++) {
                    await session.switchToParentFrame();

                    // after last element have to get data from parent frame
                    if (i < frames.length) {
                        await session.switchFrame(await session.$(`iframe[src="${frames[i]}"]`));
                    }

                    const origin = await session.execute<string, []>(() => window.location.origin);

                    if (!origin || origin === "null" || framesData[origin]) {
                        continue;
                    }

                    const frameData: FrameData = {};

                    if (options.localStorage || options.sessionStorage) {
                        const { localStorage, sessionStorage } = await session.execute<StorageData, []>(dumpStorage);

                        if (localStorage && options.localStorage) {
                            frameData.localStorage = localStorage;
                        }

                        if (sessionStorage && options.sessionStorage) {
                            frameData.sessionStorage = sessionStorage;
                        }
                    }

                    if (frameData.localStorage || frameData.sessionStorage) {
                        framesData[origin] = frameData;
                    }
                }

                await session.switchToParentFrame();

                data.framesData = framesData;
                break;
            }
            case DEVTOOLS_PROTOCOL: {
                if (options.cookies) {
                    const cookies = await session.getAllCookies();

                    data.cookies = cookies.map(
                        cookie =>
                            ({
                                ...cookie,
                                sameSite: cookie.sameSite ? _.startCase(cookie.sameSite) : cookie.sameSite,
                            } as Cookie),
                    );
                }

                const page = await getActivePuppeteerPage(session);

                if (!page) {
                    break;
                }

                const frames = page.frames();

                const framesData: Record<string, FrameData> = {};

                for (const frame of frames) {
                    const origin = new URL(frame.url()).origin;

                    if (origin === "null" || framesData[origin]) {
                        continue;
                    }

                    const frameData: FrameData = {};

                    if (options.localStorage || options.sessionStorage) {
                        const { localStorage, sessionStorage }: StorageData = await frame.evaluate(dumpStorage);

                        if (localStorage && options.localStorage) {
                            frameData.localStorage = localStorage;
                        }

                        if (sessionStorage && options.sessionStorage) {
                            frameData.sessionStorage = sessionStorage;
                        }
                    }

                    if (frameData.localStorage || frameData.sessionStorage) {
                        framesData[origin] = frameData;
                    }
                }

                data.framesData = framesData;
                break;
            }
        }

        if (options && options.cookieFilter && data.cookies) {
            data.cookies = data.cookies.filter(options.cookieFilter);
        }

        const dataIsEmpty = data.cookies?.length === 0 && _.isEmpty(data.framesData);

        if (options && options.path && !dataIsEmpty) {
            await fs.outputJson(options.path, data, { spaces: 2 });

            if (options.keepFile) {
                logger.warn(
                    "\x1b[31mOption keepFile in stateOpts now is true. Please be aware that the file containing authorization data will not be automatically deleted after the tests are completed!\x1b[0m",
                );
            } else {
                if (process.send) {
                    process.send({
                        event: MasterEvents.ADD_FILE_TO_REMOVE,
                        data: options.path,
                    });
                }

                addGlobalFileToRemove(options.path);

                browser.emitter.emit(MasterEvents.ADD_FILE_TO_REMOVE, options.path);
            }
        }

        return data;
    });
};
