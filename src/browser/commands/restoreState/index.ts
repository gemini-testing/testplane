// import fs from "fs-extra";

// import { restoreIndexedDB } from "./restoreIndexedDB";

import type { Browser } from "../../types";

// type RestoreStateOptions = {
//     path: string,
// }

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand(
        "restoreState",
        async (/* options: RestoreStateOptions */) => {

        }
    );
};
