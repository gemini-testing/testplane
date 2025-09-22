import fs from "fs-extra";

import * as logger from "../../../utils/logger";
import type { Browser } from "../../types";
import { DumpIndexDB, dumpIndexedDB } from "./dumpIndexedDB";
import { dumpStorage, StorageData } from "./dumpStorage";
import { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } from "../../../constants/config";
import { Cookie } from "@testplane/wdio-protocols";

export type SaveStateOptions = {
    path: string;

    cookies?: boolean;
    localStorage?: boolean;
    sessionStorage?: boolean;
    indexDB?: boolean;
};

export type FrameData = StorageData & {
    indexDB?: Record<string, DumpIndexDB>;
};

export type SaveStateData = {
    cookies?: Array<Cookie>;
    framesData: Record<string, FrameData>;
};

export const defaultOptions = {
    cookies: true,
    localStorage: true,
    sessionStorage: true,
    indexDB: false,
};

export const getWebdriverFrames = async (session: WebdriverIO.Browser): Promise<string[]> =>
    session.execute<string[], []>(() =>
        Array.from(document.getElementsByTagName("iframe"))
            .map(el => el.getAttribute("src") as string)
            .filter(src => src !== null && src !== "about:blank"),
    );

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("saveState", async (_options: SaveStateOptions) => {
        const options = { ...defaultOptions, ..._options };

        const data: SaveStateData = {
            framesData: {},
        };

        logger.log("Save state", options);

        switch (browser.config.automationProtocol) {
            case WEBDRIVER_PROTOCOL: {
                if (options.cookies) {
                    const storageCookies = await session.storageGetCookies({});

                    data.cookies = storageCookies.cookies.map(cookie => ({
                        name: cookie.name,
                        value: cookie.value.value,
                        domain: cookie.domain,
                        path: cookie.path,
                        expires: cookie.expiry,
                        httpOnly: cookie.httpOnly,
                        secure: cookie.secure,
                        sameSite: cookie.sameSite,
                    }));
                }

                await session.switchToParentFrame();

                const frames = await getWebdriverFrames(session);
                const framesData: Record<string, FrameData> = {};

                for (let i = -1; i < frames.length; i++) {
                    await session.switchToParentFrame();

                    // start with -1 for get data from main page
                    if (i > -1) {
                        await session.switchFrame(frames[i]);
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

                    if (options.indexDB) {
                        const indexDB: Record<string, DumpIndexDB> | undefined = await session.execute(dumpIndexedDB);

                        if (indexDB) {
                            frameData.indexDB = indexDB;
                        }
                    }

                    if (frameData.localStorage || frameData.sessionStorage || frameData.indexDB) {
                        framesData[origin] = frameData;
                    }
                }

                await session.switchToParentFrame();

                data.framesData = framesData;
                break;
            }
            case DEVTOOLS_PROTOCOL: {
                data.cookies = await session.getAllRequestsCookies();

                const puppeteer = await session.getPuppeteer();
                const pages = await puppeteer.pages();
                const frames = pages[0].frames();

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

                    if (options.indexDB) {
                        const indexDB: Record<string, DumpIndexDB> | undefined = await frame.evaluate(dumpIndexedDB);

                        if (indexDB) {
                            frameData.indexDB = indexDB;
                        }
                    }

                    if (frameData.localStorage || frameData.sessionStorage || frameData.indexDB) {
                        framesData[origin] = frameData;
                    }
                }

                data.framesData = framesData;
                break;
            }
        }

        if (options && options.path) {
            logger.log("State saved");
            await fs.writeJson(options.path, data, { spaces: 2 });
        }
    });
};
