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
var _ConfigController_eventBus;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigController = void 0;
const events_1 = require("../../events");
class ConfigController {
    static create(eventBus) {
        return new this(eventBus);
    }
    constructor(eventBus) {
        _ConfigController_eventBus.set(this, void 0);
        __classPrivateFieldSet(this, _ConfigController_eventBus, eventBus, "f");
    }
    testTimeout(timeout) {
        __classPrivateFieldGet(this, _ConfigController_eventBus, "f").emit(events_1.TestReaderEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
            treeBuilder.addTrap(obj => (obj.timeout = timeout));
        });
        return this;
    }
}
exports.ConfigController = ConfigController;
_ConfigController_eventBus = new WeakMap();
//# sourceMappingURL=config-controller.js.map