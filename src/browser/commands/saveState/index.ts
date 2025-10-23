import fs from "fs-extra";

import _ from "lodash";
import type { Browser } from "../../types";
import { dumpStorage, StorageData } from "./dumpStorage";
import { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } from "../../../constants/config";
import { isSupportIsolation } from "../../../utils/browser";
import { ExistingBrowser, getActivePuppeteerPage } from "../../existing-browser";
import { Protocol } from "devtools-protocol";
import * as logger from "../../../utils/logger";

export type SaveStateOptions = {
    path?: string;

    cookies?: boolean;
    localStorage?: boolean;
    sessionStorage?: boolean;

    cookieFilter?: (cookie: Protocol.Network.CookieParam) => boolean;
};

export type FrameData = StorageData;

export type SaveStateData = {
    cookies?: Array<Protocol.Network.CookieParam>;
    framesData: Record<string, FrameData>;
};

export const defaultOptions = {
    cookies: true,
    localStorage: true,
    sessionStorage: true,
};

export const getCalculatedProtocol = (browser: Browser): typeof DEVTOOLS_PROTOCOL | typeof WEBDRIVER_PROTOCOL => {
    const protocol = browser.config.automationProtocol;

    if (protocol === DEVTOOLS_PROTOCOL) {
        return DEVTOOLS_PROTOCOL;
    }

    if (
        protocol === WEBDRIVER_PROTOCOL &&
        browser.config.isolation &&
        isSupportIsolation(browser.publicAPI.capabilities.browserName!, browser.publicAPI.capabilities.browserVersion!)
    ) {
        return DEVTOOLS_PROTOCOL;
    }

    return protocol;
};

export const getWebdriverFrames = async (session: WebdriverIO.Browser): Promise<string[]> =>
    session.execute<string[], []>(() =>
        Array.from(document.getElementsByTagName("iframe"))
            .map(el => el.getAttribute("src") as string)
            .filter(src => src !== null && src !== "about:blank"),
    );

export default (browser: ExistingBrowser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("saveState", async (_options: SaveStateOptions = {}): Promise<SaveStateData | undefined> => {
        const currentUrl = new URL(await session.getUrl());

        if (!currentUrl.origin || currentUrl.origin === "null") {
            logger.error("Before saveState first open page using url command");
            process.exit(1);
        }

        const options = { ...defaultOptions, ..._options };

        const data: SaveStateData = {
            framesData: {},
        };

        switch (getCalculatedProtocol(browser)) {
            case WEBDRIVER_PROTOCOL: {
                if (options.cookies) {
                    const cookies = await session.getCookies();

                    data.cookies = cookies.map(
                        cookie =>
                            ({
                                ...cookie,
                                sameSite: cookie.sameSite ? _.startCase(cookie.sameSite) : cookie.sameSite,
                            } as Protocol.Network.CookieParam),
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
                    const cookies = await browser.getAllRequestsCookies();

                    data.cookies = cookies.map(
                        cookie =>
                            ({
                                ...cookie,
                                sameSite: cookie.sameSite ? _.startCase(cookie.sameSite) : cookie.sameSite,
                            } as Protocol.Network.CookieParam),
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

        if (options && options.path) {
            await fs.writeJson(options.path, data, { spaces: 2 });
        }

        return data;
    });
};
