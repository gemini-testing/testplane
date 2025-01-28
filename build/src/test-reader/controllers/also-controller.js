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
var _AlsoController_instances, _AlsoController_eventBus, _AlsoController_addTrap, _AlsoController_match;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlsoController = void 0;
const events_1 = require("../../events");
class AlsoController {
    static create(eventBus) {
        return new this(eventBus);
    }
    constructor(eventBus) {
        _AlsoController_instances.add(this);
        _AlsoController_eventBus.set(this, void 0);
        __classPrivateFieldSet(this, _AlsoController_eventBus, eventBus, "f");
    }
    in(matchers) {
        __classPrivateFieldGet(this, _AlsoController_instances, "m", _AlsoController_addTrap).call(this, browserId => __classPrivateFieldGet(this, _AlsoController_instances, "m", _AlsoController_match).call(this, browserId, matchers));
        return this;
    }
}
exports.AlsoController = AlsoController;
_AlsoController_eventBus = new WeakMap(), _AlsoController_instances = new WeakSet(), _AlsoController_addTrap = function _AlsoController_addTrap(match) {
    __classPrivateFieldGet(this, _AlsoController_eventBus, "f").emit(events_1.TestReaderEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
        treeBuilder.addTrap(obj => {
            if (match(obj.browserId)) {
                obj.enable();
            }
        });
    });
}, _AlsoController_match = function _AlsoController_match(browserId, matchers) {
    return [].concat(matchers).some(m => {
        return m instanceof RegExp ? m.test(browserId) : m === browserId;
    });
};
//# sourceMappingURL=also-controller.js.map