"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _BrowserVersionController_browserId, _BrowserVersionController_eventBus;
const ReadEvents = require("../read-events");
class BrowserVersionController {
    static create(...args) {
        return new this(...args);
    }
    constructor(browserId, eventBus) {
        _BrowserVersionController_browserId.set(this, void 0);
        _BrowserVersionController_eventBus.set(this, void 0);
        __classPrivateFieldSet(this, _BrowserVersionController_browserId, browserId, "f");
        __classPrivateFieldSet(this, _BrowserVersionController_eventBus, eventBus, "f");
    }
    version(browserVersion) {
        __classPrivateFieldGet(this, _BrowserVersionController_eventBus, "f").emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
            treeBuilder.addTrap(obj => {
                if (obj.browserId === __classPrivateFieldGet(this, _BrowserVersionController_browserId, "f")) {
                    obj.browserVersion = browserVersion;
                }
            });
        });
        return this;
    }
}
_BrowserVersionController_browserId = new WeakMap(), _BrowserVersionController_eventBus = new WeakMap();
function mkProvider(knownBrowsers, eventBus) {
    return browserId => {
        if (!knownBrowsers.includes(browserId)) {
            throw new Error(`browser "${browserId}" was not found in config file`);
        }
        return BrowserVersionController.create(browserId, eventBus);
    };
}
module.exports = {
    mkProvider,
    BrowserVersionController,
};
//# sourceMappingURL=browser-version-controller.js.map