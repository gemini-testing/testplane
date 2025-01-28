"use strict";
const { ClientBridgeError } = require("./error");
module.exports = class ClientBridge {
    static create(browser, script) {
        return new ClientBridge(browser, script);
    }
    constructor(browser, script) {
        this._browser = browser;
        this._script = script;
    }
    call(name, args = []) {
        return this._callCommand(this._clientMethodCommand(name, args), true);
    }
    _callCommand(command, injectAllowed) {
        return this._browser
            .evalScript(command)
            .then(result => {
            if (!result || !result.isClientScriptNotInjected) {
                return Promise.resolve(result);
            }
            if (injectAllowed) {
                return this._inject().then(() => this._callCommand(command, false));
            }
            return Promise.reject(new ClientBridgeError("Unable to inject client script"));
        })
            .catch(e => Promise.reject(new ClientBridgeError(e.message)));
    }
    _clientMethodCommand(name, args) {
        const params = args.map(JSON.stringify).join(", ");
        const call = `__geminiCore.${name}(${params})`;
        return this._guardClientCall(call);
    }
    _guardClientCall(call) {
        return `typeof __geminiCore !== "undefined" ? ${call} : {isClientScriptNotInjected: true}`;
    }
    _inject() {
        return this._browser.injectScript(this._script);
    }
};
//# sourceMappingURL=client-bridge.js.map