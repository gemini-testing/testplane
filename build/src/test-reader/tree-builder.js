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
var _TreeBuilder_instances, _TreeBuilder_traps, _TreeBuilder_filters, _TreeBuilder_rootSuite, _TreeBuilder_applyTraps;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeBuilder = void 0;
class TreeBuilder {
    constructor() {
        _TreeBuilder_instances.add(this);
        _TreeBuilder_traps.set(this, void 0);
        _TreeBuilder_filters.set(this, void 0);
        _TreeBuilder_rootSuite.set(this, void 0);
        __classPrivateFieldSet(this, _TreeBuilder_traps, [], "f");
        __classPrivateFieldSet(this, _TreeBuilder_filters, [], "f");
        __classPrivateFieldSet(this, _TreeBuilder_rootSuite, null, "f");
    }
    addSuite(suite, parent = null) {
        if (!__classPrivateFieldGet(this, _TreeBuilder_rootSuite, "f")) {
            __classPrivateFieldSet(this, _TreeBuilder_rootSuite, suite, "f");
        }
        if (parent) {
            parent.addSuite(suite);
        }
        __classPrivateFieldGet(this, _TreeBuilder_instances, "m", _TreeBuilder_applyTraps).call(this, suite);
        return this;
    }
    addTest(test, parent) {
        parent.addTest(test);
        __classPrivateFieldGet(this, _TreeBuilder_instances, "m", _TreeBuilder_applyTraps).call(this, test);
        return this;
    }
    addBeforeEachHook(hook, parent) {
        parent.addBeforeEachHook(hook);
        return this;
    }
    addAfterEachHook(hook, parent) {
        parent.addAfterEachHook(hook);
        return this;
    }
    addTrap(fn) {
        __classPrivateFieldGet(this, _TreeBuilder_traps, "f").push(fn);
        return this;
    }
    addTestFilter(fn) {
        __classPrivateFieldGet(this, _TreeBuilder_filters, "f").push(fn);
        return this;
    }
    applyFilters() {
        if (__classPrivateFieldGet(this, _TreeBuilder_rootSuite, "f") && __classPrivateFieldGet(this, _TreeBuilder_filters, "f").length !== 0) {
            __classPrivateFieldGet(this, _TreeBuilder_rootSuite, "f").filterTests(test => {
                return __classPrivateFieldGet(this, _TreeBuilder_filters, "f").every(f => f(test));
            });
        }
        return this;
    }
    getRootSuite() {
        return __classPrivateFieldGet(this, _TreeBuilder_rootSuite, "f");
    }
}
exports.TreeBuilder = TreeBuilder;
_TreeBuilder_traps = new WeakMap(), _TreeBuilder_filters = new WeakMap(), _TreeBuilder_rootSuite = new WeakMap(), _TreeBuilder_instances = new WeakSet(), _TreeBuilder_applyTraps = function _TreeBuilder_applyTraps(obj) {
    __classPrivateFieldGet(this, _TreeBuilder_traps, "f").forEach(trap => trap(obj));
    __classPrivateFieldSet(this, _TreeBuilder_traps, [], "f");
};
//# sourceMappingURL=tree-builder.js.map