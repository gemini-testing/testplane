import type BrowserAgent from "../browser-agent";
import type NewBrowser from "../../browser/new-browser";

export default class HighPriorityBrowserAgent {
    public static create(browserAgent: BrowserAgent) {
        return new this(browserAgent);
    }

    constructor(private _browserAgent: BrowserAgent) {}

    public getBrowser(): Promise<NewBrowser> {
        return this._browserAgent.getBrowser({highPriority: true});
    }

    public freeBrowser(...args) {
        return this._browserAgent.freeBrowser(...args);
    }
};
