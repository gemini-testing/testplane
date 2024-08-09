"use strict";

import Browser from "../browser/browser";

interface Pool<T extends Browser = Browser> {
    getBrowser(id: string, opts?: object): Promise<T>;
    freeBrowser(browser: T, opts?: object): Promise<void>;
    cancel(): void;
}

export default Pool;
