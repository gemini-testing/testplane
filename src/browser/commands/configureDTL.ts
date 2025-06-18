import type { Browser } from "../types";
import { configure } from "../queries";

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("configureDTL", configure);
};
