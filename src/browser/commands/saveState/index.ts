import fs from "fs-extra";

import type { Browser } from "../../types";
import { dumpIndexedDB } from "./dumpIndexedDB";
import { dumpStorage, StorageData } from "./dumpStorage";
import { Protocol } from "devtools-protocol";
import { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } from "../../../constants/config";

export type SaveStateOptions = {
    path: string;

    cookies?: boolean;
    localStorage?: boolean;
    sessionStorage?: boolean;
    indexDB?: boolean;
};

type FrameData = StorageData & {
    indexDB?: Record<string, unknown>;
};

export type SaveStateData = {
    cookies?: Array<Protocol.Network.CookieParam>;
    framesData?: Record<string, FrameData>;
};

export const defaultOptions = {
    cookies: true,
    localStorage: true,
    sessionStorage: true,
    indexDB: false,
};

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("saveState", async (_options: SaveStateOptions) => {
        const options = { ...defaultOptions, ..._options };

        const data: SaveStateData = {};

        switch (browser.config.automationProtocol) {
            case WEBDRIVER_PROTOCOL: {
                if (options.cookies) {
                    const storageCookies = await session.storageGetCookies({});

                    data.cookies = storageCookies.cookies.map(cookie => ({
                        ...cookie,
                        value: cookie.value.value,
                        sameSite: cookie.sameSite.toLowerCase() as Protocol.Network.CookieSameSite,
                    }));
                }

                await session.switchToParentFrame();

                const frames = await session.execute<string[], []>(() =>
                    Array.from(document.getElementsByTagName("iframe"))
                        .map(el => el.getAttribute("src") as string)
                        .filter(src => src !== null && src !== "about:blank"),
                );

                const framesData: Record<string, FrameData> = {};

                for (let i = -1; i < frames.length; i++) {
                    await session.switchToParentFrame();

                    if (i > -1) {
                        await session.switchFrame(frames[i]);
                    }

                    const origin = await session.execute<string, []>(() => window.location.origin);

                    if (!origin || origin === "null" || framesData[origin]) {
                        continue;
                    }

                    const { localStorage, sessionStorage } = await session.execute<StorageData, []>(dumpStorage);

                    const frameData: FrameData = {};

                    if (localStorage && options.localStorage) {
                        frameData.localStorage = localStorage;
                    }

                    if (sessionStorage && options.sessionStorage) {
                        frameData.sessionStorage = sessionStorage;
                    }

                    if (options.indexDB) {
                        const indexDB: Record<string, unknown> | undefined = await session.execute(dumpIndexedDB);

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

                    const { localStorage, sessionStorage }: StorageData = await frame.evaluate(dumpStorage);

                    const frameData: FrameData = {};

                    if (localStorage && options.localStorage) {
                        frameData.localStorage = localStorage;
                    }

                    if (sessionStorage && options.sessionStorage) {
                        frameData.sessionStorage = sessionStorage;
                    }

                    if (options.indexDB) {
                        const indexDB: Record<string, unknown> | undefined = await frame.evaluate(dumpIndexedDB);

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
            await fs.writeJson(options.path, data, { spaces: 2 });
        }
    });
};
