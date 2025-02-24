import { ClientBridgeError } from "./error";
import { ExistingBrowser } from "../existing-browser";

export class ClientBridge {
    private _browser: ExistingBrowser;
    private _script: string;

    static create(browser: ExistingBrowser, script: string): ClientBridge {
        return new ClientBridge(browser, script);
    }

    constructor(browser: ExistingBrowser, script: string) {
        this._browser = browser;
        this._script = script;
    }

    async call<T>(name: string, args: unknown[] = []): Promise<T> {
        return this._callCommand<T>(this._clientMethodCommand(name, args), true);
    }

    private async _callCommand<T>(command: string, injectAllowed: boolean): Promise<T> {
        try {
            const result = await this._browser.evalScript<{ isClientScriptNotInjected?: boolean }>(command);

            if (!result || !result.isClientScriptNotInjected) {
                return result as T;
            }

            if (injectAllowed) {
                await this._inject();
                return this._callCommand<T>(command, false);
            }

            throw new ClientBridgeError("Unable to inject client script");
        } catch (e) {
            throw new ClientBridgeError((e as Error).message);
        }
    }

    private _clientMethodCommand(name: string, args: unknown[]): string {
        const params = args.map(arg => JSON.stringify(arg)).join(", ");
        const call = `__geminiCore.${name}(${params})`;
        return this._guardClientCall(call);
    }

    private _guardClientCall(call: string): string {
        return `typeof __geminiCore !== "undefined" ? ${call} : {isClientScriptNotInjected: true}`;
    }

    private async _inject(): Promise<void> {
        await this._browser.injectScript(this._script);
    }
}
