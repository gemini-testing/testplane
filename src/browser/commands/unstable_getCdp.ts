import { ExistingBrowser } from "../existing-browser";

export default (browser: ExistingBrowser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("unstable_getCdp", async () => {
        return browser.cdp;
    });
};
