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
var _OnlyController_instances, _OnlyController_eventBus, _OnlyController_addTrap, _OnlyController_match;
const ReadEvents = require("../read-events");
class OnlyController {
    static create(...args) {
        return new this(...args);
    }
    constructor(eventBus) {
        _OnlyController_instances.add(this);
        _OnlyController_eventBus.set(this, void 0);
        __classPrivateFieldSet(this, _OnlyController_eventBus, eventBus, "f");
    }
    in(matchers) {
        __classPrivateFieldGet(this, _OnlyController_instances, "m", _OnlyController_addTrap).call(this, browserId => __classPrivateFieldGet(this, _OnlyController_instances, "m", _OnlyController_match).call(this, browserId, matchers));
        return this;
    }
    notIn(matchers) {
        __classPrivateFieldGet(this, _OnlyController_instances, "m", _OnlyController_addTrap).call(this, browserId => !__classPrivateFieldGet(this, _OnlyController_instances, "m", _OnlyController_match).call(this, browserId, matchers));
        return this;
    }
}
_OnlyController_eventBus = new WeakMap(), _OnlyController_instances = new WeakSet(), _OnlyController_addTrap = function _OnlyController_addTrap(match) {
    __classPrivateFieldGet(this, _OnlyController_eventBus, "f").emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
        treeBuilder.addTrap(obj => {
            if (!match(obj.browserId)) {
                obj.disable();
            }
        });
    });
}, _OnlyController_match = function _OnlyController_match(browserId, matchers) {
    return [].concat(matchers).some(m => {
        return m instanceof RegExp ? m.test(browserId) : m === browserId;
    });
};
module.exports = {
    OnlyController,
};
//# sourceMappingURL=only-controller.js.map