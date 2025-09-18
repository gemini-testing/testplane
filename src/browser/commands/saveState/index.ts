import fs from "fs-extra";

import type { Browser } from "../../types";
import { dumpIndexedDB } from "./dumpIndexedDB";
import { dumpStorage, StorageData } from "./dumpStorage";

type SaveStateOptions = {
    path?: string,

    cookies?: boolean,
    localStorage?: boolean,
    sessionStorage?: boolean,
    indexDb?: boolean,
}

type FrameData = StorageData & {
    indexDB?: Record<string, unknown>,
};

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

            const framesData: Record<string, FrameData> = {};

            for (const frame of frames) {
                const origin = new URL(frame.url()).origin;

                if (origin === "null" || framesData[origin]) {
                    continue;
                }

                const { localStorage, sessionStorage }: StorageData = await frame.evaluate(dumpStorage);
                const indexDB: Record<string, unknown> | undefined = await frame.evaluate(dumpIndexedDB);

                if (localStorage || sessionStorage || indexDB) {
                    framesData[origin] = {
                        localStorage,
                        sessionStorage,
                        indexDB,
                    };
                }
            }

            const data = {
                cookies: [
                    ...cookies,
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
