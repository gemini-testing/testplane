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
var _SkipController_instances, _SkipController_eventBus, _SkipController_addTrap, _SkipController_match;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipController = void 0;
const events_1 = require("../../events");
class SkipController {
    static create(eventBus) {
        return new this(eventBus);
    }
    constructor(eventBus) {
        _SkipController_instances.add(this);
        _SkipController_eventBus.set(this, void 0);
        __classPrivateFieldSet(this, _SkipController_eventBus, eventBus, "f");
    }
    in(matchers, reason, { silent } = {}) {
        __classPrivateFieldGet(this, _SkipController_instances, "m", _SkipController_addTrap).call(this, browserId => __classPrivateFieldGet(this, _SkipController_instances, "m", _SkipController_match).call(this, matchers, browserId), reason, { silent });
        return this;
    }
    notIn(matchers, reason, { silent } = {}) {
        __classPrivateFieldGet(this, _SkipController_instances, "m", _SkipController_addTrap).call(this, browserId => !__classPrivateFieldGet(this, _SkipController_instances, "m", _SkipController_match).call(this, matchers, browserId), reason, { silent });
        return this;
    }
}
exports.SkipController = SkipController;
_SkipController_eventBus = new WeakMap(), _SkipController_instances = new WeakSet(), _SkipController_addTrap = function _SkipController_addTrap(match, reason, { silent } = {}) {
    __classPrivateFieldGet(this, _SkipController_eventBus, "f").emit(events_1.TestReaderEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
        treeBuilder.addTrap(obj => {
            if (obj.browserId && !match(obj.browserId)) {
                return;
            }
            if (silent) {
                obj.disable();
            }
            else {
                obj.skip({ reason });
            }
        });
    });
}, _SkipController_match = function _SkipController_match(matchers, browserId) {
    return [].concat(matchers).some(m => {
        return m instanceof RegExp ? m.test(browserId) : m === browserId;
    });
};
//# sourceMappingURL=skip-controller.js.map