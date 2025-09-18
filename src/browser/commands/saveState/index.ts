import type { Browser } from "../../types";
import { dumpIndexedDB } from "./dumpIndexedDB";
import fs from "fs-extra";

interface SaveStateOptions {
    path?: string;

    cookies?: boolean;
    localStorage?: boolean;
    sessionStorage?: boolean;
    indexDb?: boolean;
}

const getLocalStorage = (): Record<string, unknown> => {
    const storage: Storage = window.localStorage;
    const data: Record<string, string> = {};

    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);

        if (key) {
            data[key] = storage.getItem(key) as string;
        }
    }
    return data;
}

const getSessionStorage = (): Record<string, unknown> => {
    const storage: Storage = window.sessionStorage;
    const data: Record<string, string> = {};

    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);

        if (key) {
            data[key] = storage.getItem(key) as string;
        }
    }
    return data;
}

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand(
        "saveState",
        async (options: SaveStateOptions) => {
            const cookies = await session.getAllCookies();
            // @ts-ignore
            const requestsCookies = await session.getAllRequestsCookies();

            const puppeteer = await session.getPuppeteer();
            const pages = await puppeteer.pages();
            const frames = pages[0].frames();

            const framesData: Record<string, {
                localStorage: Record<string, unknown>,
                sessionStorage: Record<string, unknown>,
                indexDB: Record<string, unknown>,
            }> = {};

            for (const frame of frames) {
                const localStorage: Record<string, unknown> = await session.execute(getLocalStorage);
                const sessionStorage: Record<string, unknown> = await session.execute(getSessionStorage);
                const indexDB: Record<string, unknown> = await session.execute(dumpIndexedDB);

                framesData[frame.url()] = {
                    localStorage,
                    sessionStorage,
                    indexDB,
                };
            }

            const data = {
                cookies: [
                    ...cookies,
                    '------------------------------------',
                    ...requestsCookies,
                ],
                framesData,
            };

            if (options && options.path) {
                await fs.writeJson(options.path, data, {spaces: 2});
            }
        }
    );
};
