"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientBridge = void 0;
const error_1 = require("./error");
class ClientBridge {
    static create(browser, script) {
        return new ClientBridge(browser, script);
    }
    constructor(browser, script) {
        this._browser = browser;
        this._script = script;
    }
    async call(name, args = []) {
        return this._callCommand(this._clientMethodCommand(name, args), true);
    }
    async _callCommand(command, injectAllowed) {
        try {
            const result = await this._browser.evalScript(command);
            if (!result || !result.isClientScriptNotInjected) {
                return result;
            }
            if (injectAllowed) {
                await this._inject();
                return this._callCommand(command, false);
            }
            throw new error_1.ClientBridgeError("Unable to inject client script");
        }
        catch (e) {
            throw new error_1.ClientBridgeError(e.message);
        }
    }
    _clientMethodCommand(name, args) {
        const params = args.map(arg => JSON.stringify(arg)).join(", ");
        const call = `__geminiCore.${name}(${params})`;
        return this._guardClientCall(call);
    }
    _guardClientCall(call) {
        return `typeof __geminiCore !== "undefined" ? ${call} : {isClientScriptNotInjected: true}`;
    }
    async _inject() {
        await this._browser.injectScript(this._script);
    }
}
exports.ClientBridge = ClientBridge;
//# sourceMappingURL=client-bridge.js.map