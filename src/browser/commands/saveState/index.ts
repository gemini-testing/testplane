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

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand(
        "saveState",
        async (options: SaveStateOptions) => {
            const cookies = await session.getAllCookies();

            // browser.getA

            const localStorage: unknown = await session.execute(() => (
                JSON.parse(JSON.stringify(localStorage))
            ));
            const sessionStorage: unknown = await session.execute(() => (
                JSON.parse(JSON.stringify(sessionStorage))
            ));
            const indexDB: unknown = await session.execute(dumpIndexedDB);

            const puppeteer = await session.getPuppeteer();
            const pages = await puppeteer.pages();


            // @ts-ignore
            const ppp = await puppeteer.pages();

            // browser.publicAPI.ori

            // const urls: Record<string, {
            //     sessionStorage: Record<string, unknown>;
            //     localStorage: Record<string, unknown>;
            // }> = {};

            const data = {
                cookies,
                localStorage,
                sessionStorage,
                indexDB,
                // pages: pages.map((page) => page.frames()),
                frames: pages[0].frames().map((f) => f.url()),
                ppp,
            };

            if (options && options.path) {
                await fs.writeJson(options.path, data);
            }
        }
    );
};
