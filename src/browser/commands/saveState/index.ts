import fs from "fs-extra";

import type { Browser } from "../../types";
import { dumpIndexedDB } from "./dumpIndexedDB";
import { dumpStorage, StorageData } from "./dumpStorage";
import { Protocol } from "devtools-protocol";

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

            const frameData: FrameData = {};

            if (localStorage && options.localStorage) {
                frameData.localStorage = localStorage;
            }

            if (sessionStorage && options.sessionStorage) {
                frameData.sessionStorage = sessionStorage;
            }

            if (indexDB && options.indexDB) {
                frameData.indexDB = indexDB;
            }

            if (frameData.localStorage || frameData.sessionStorage || frameData.indexDB) {
                framesData[origin] = frameData;
            }
        }

        const data: SaveStateData = {
            framesData,
        };

        if (options.cookies) {
            data.cookies = requestsCookies;
        }

        if (options && options.path) {
            await fs.writeJson(options.path, data, { spaces: 2 });
        }
    });
};
