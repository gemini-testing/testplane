import { Browser } from "../browser";
import { setupBrowser } from "../queries";

const _addDTLCommands = (browser: Browser): void => {
    const { publicAPI: session } = browser;

    setupBrowser(session);
};

export default _addDTLCommands;
