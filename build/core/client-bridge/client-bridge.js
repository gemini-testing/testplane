"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../errors");
class ClientBridge {
    constructor(_browser, _script) {
        this._browser = _browser;
        this._script = _script;
    }
    static create(browser, script) {
        return new ClientBridge(browser, script);
    }
    call(name, args = []) {
        return this._callCommand(this._clientMethodCommand(name, args), true);
    }
    async _callCommand(command, injectAllowed) {
        const result = await this._browser.evalScript(command);
        try {
            if (!result || !result.isClientScriptNotInjected) {
                return result;
            }
            if (injectAllowed) {
                await this._inject();
                return this._callCommand(command, false);
            }
            throw new errors_1.ClientBridgeError('Unable to inject gemini-core client script');
        }
        catch (e) {
            throw new errors_1.ClientBridgeError(e.message);
        }
    }
    _clientMethodCommand(name, args) {
        const params = args.map((arg) => JSON.stringify(arg)).join(', ');
        const call = `__geminiCore.${name}(${params})`;
        return this._guardClientCall(call);
    }
    _guardClientCall(call) {
        return `typeof __geminiCore !== "undefined" ? ${call} : {isClientScriptNotInjected: true}`;
    }
    _inject() {
        return this._browser.injectScript(this._script);
    }
}
exports.default = ClientBridge;
