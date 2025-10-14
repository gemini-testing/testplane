import type { Browser } from "../browser";

const setWindowSizeCommand = (browser: Browser): void => {
    const { publicAPI: session } = browser;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session.overwriteCommand("setWindowSize", async (origSetWindowSize: any, width: number, height: number) => {
        browser.applyState({
            currentWindowSize: {
                width,
                height,
            },
        });

        const result = await origSetWindowSize(width, height);
        return result;
    });
};

export default setWindowSizeCommand;
