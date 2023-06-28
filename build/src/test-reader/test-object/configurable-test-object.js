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
var _ConfigurableTestObject_instances, _ConfigurableTestObject_data, _ConfigurableTestObject_getInheritedProperty;
const { TestObject } = require("./test-object");
const _ = require("lodash");
class ConfigurableTestObject extends TestObject {
    constructor({ title, file, id }) {
        super({ title });
        _ConfigurableTestObject_instances.add(this);
        _ConfigurableTestObject_data.set(this, void 0);
        __classPrivateFieldSet(this, _ConfigurableTestObject_data, { id, file }, "f");
    }
    assign(src) {
        __classPrivateFieldSet(this, _ConfigurableTestObject_data, { ...__classPrivateFieldGet(src, _ConfigurableTestObject_data, "f") }, "f");
        return super.assign(src);
    }
    skip({ reason }) {
        this.pending = true;
        this.skipReason = reason;
    }
    disable() {
        this.disabled = true;
        this.silentSkip = true;
    }
    get id() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").id;
    }
    get file() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").file;
    }
    set pending(val) {
        __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").pending = val;
    }
    get pending() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_instances, "m", _ConfigurableTestObject_getInheritedProperty).call(this, "pending", false);
    }
    set skipReason(reason) {
        __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").skipReason = reason;
    }
    get skipReason() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_instances, "m", _ConfigurableTestObject_getInheritedProperty).call(this, "skipReason", "");
    }
    set disabled(val) {
        __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").disabled = val;
    }
    get disabled() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_instances, "m", _ConfigurableTestObject_getInheritedProperty).call(this, "disabled", false);
    }
    set silentSkip(val) {
        __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").silentSkip = val;
    }
    get silentSkip() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_instances, "m", _ConfigurableTestObject_getInheritedProperty).call(this, "silentSkip", false);
    }
    set timeout(timeout) {
        __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").timeout = timeout;
    }
    get timeout() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_instances, "m", _ConfigurableTestObject_getInheritedProperty).call(this, "timeout", 0);
    }
    set browserId(id) {
        __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").browserId = id;
    }
    get browserId() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_instances, "m", _ConfigurableTestObject_getInheritedProperty).call(this, "browserId", undefined);
    }
    set browserVersion(version) {
        __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f").browserVersion = version;
    }
    get browserVersion() {
        return __classPrivateFieldGet(this, _ConfigurableTestObject_instances, "m", _ConfigurableTestObject_getInheritedProperty).call(this, "browserVersion", undefined);
    }
    get hasBrowserVersionOverwritten() {
        return "browserVersion" in __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f");
    }
}
_ConfigurableTestObject_data = new WeakMap(), _ConfigurableTestObject_instances = new WeakSet(), _ConfigurableTestObject_getInheritedProperty = function _ConfigurableTestObject_getInheritedProperty(name, defaultValue) {
    return name in __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f") ? __classPrivateFieldGet(this, _ConfigurableTestObject_data, "f")[name] : _.get(this.parent, name, defaultValue);
};
module.exports = {
    ConfigurableTestObject,
};
//# sourceMappingURL=configurable-test-object.js.map