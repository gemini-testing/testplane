import fs from "fs-extra";

import { clearAllIndexedDB } from "./clearAllIndexedDB";
import { restoreIndexedDB } from "./restoreIndexedDB";
import { restoreStorage } from "./restoreStorage";

import type { Browser } from "../../types";
import { defaultOptions, SaveStateOptions } from "../saveState";
import { Protocol } from "devtools-protocol";
import { DumpIndexDB } from "../saveState/dumpIndexedDB";

type RestoreStateOptions = SaveStateOptions;

const normalizeCookies = (cookies: Array<Protocol.Network.CookieParam>): Array<Protocol.Network.CookieParam> =>
    cookies
        .filter(c => c.name && c.value && c.domain)
        .map(c => {
            const cookie: Partial<Protocol.Network.CookieParam> = {
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path || "/",
            };

            if (c.expires) {
                cookie.expires =
                    typeof c.expires === "string"
                        ? Math.floor(new Date(c.expires).getTime() / 1000)
                        : Math.floor(c.expires as number);
            }

            if (c.secure !== undefined) cookie.secure = c.secure;
            if (c.httpOnly !== undefined) cookie.httpOnly = c.httpOnly;
            if (c.sameSite) cookie.sameSite = c.sameSite;

            if (!c.domain?.startsWith(".")) {
                cookie.url = `https://${c.domain}`;
            } else {
                cookie.url = `https://${c.domain.replace(/^\./, "")}`;
            }

            return cookie as Protocol.Network.CookieParam;
        });

type FrameData = {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    indexDB: Record<string, DumpIndexDB>;
};

type RestoreState = {
    cookies: Array<Protocol.Network.CookieParam>;
    framesData: Record<string, FrameData>;
};

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("restoreState", async (_options: RestoreStateOptions) => {
        const options = { ...defaultOptions, ..._options };

        const restoreState: RestoreState = await fs.readJson(options.path);

        const puppeteer = await session.getPuppeteer();
        const pages = await puppeteer.pages();
        const page = pages[0];
        const frames = page.frames();

        if (restoreState.cookies && options.cookies) {
            const normalized = normalizeCookies(restoreState.cookies);

            await page.setCookie(...normalized);
        }

        for (const frame of frames) {
            const origin = new URL(frame.url()).origin;

            if (origin === "null" || !restoreState.framesData[origin]) {
                continue;
            }

            const frameData = restoreState.framesData[origin];

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

            if (frameData.indexDB) {
                // @todo: Doesn't work now
                await frame.evaluate(clearAllIndexedDB);
                await frame.evaluate(restoreIndexedDB, frameData.indexDB);
            }
        }
    });
};
