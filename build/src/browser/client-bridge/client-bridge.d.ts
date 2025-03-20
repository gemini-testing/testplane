import { ExistingBrowser } from "../existing-browser";
export declare class ClientBridge {
    private _browser;
    private _script;
    static create(browser: ExistingBrowser, script: string): ClientBridge;
    constructor(browser: ExistingBrowser, script: string);
    call<T>(name: string, args?: unknown[]): Promise<T>;
    private _callCommand;
    private _clientMethodCommand;
    private _guardClientCall;
    private _inject;
}
