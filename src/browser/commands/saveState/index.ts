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
            // @ts-ignore
            const requestsCookies = await session.getAllRequestsCookies();

            const localStorage: unknown = await session.execute(() => (
                JSON.parse(JSON.stringify(localStorage))
            ));
            const sessionStorage: unknown = await session.execute(() => (
                JSON.parse(JSON.stringify(sessionStorage))
            ));
            const indexDB: unknown = await session.execute(dumpIndexedDB);

            // const cookies = await session.send({
            //     method: "storage.getCookies",
            //     // method: "Network.getAllCookies",
            //     params: {
            //
            //     }
            // });

            // const puppeteer = await session.getPuppeteer();
            // const client = await puppeteer.target().createCDPSession();
            // const cookies = await client.send("Network.getAllCookies");
            // const pages = await puppeteer.pages()


            // const pages = await puppeteer.pages();
            // const page = await puppeteer.target().page();
            // const cookies = page._client.send('Network.getAllCookies');
            // page?.mainFrame().origin();
            // const client = await puppeteer.target().page();

            // const ppp = await puppeteer.pages();

            // browser.publicAPI.ori

            // const urls: Record<string, {
            //     sessionStorage: Record<string, unknown>;
            //     localStorage: Record<string, unknown>;
            // }> = {};

            const data = {
                cookies: [
                    ...cookies,
                    '------------------------------------',
                    ...requestsCookies,
                ],
                localStorage,
                sessionStorage,
                indexDB,
            };

            if (options && options.path) {
                await fs.writeJson(options.path, data, {spaces: 2});
            }
        }
    );
};
