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
var _TestObject_title;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestObject = void 0;
class TestObject {
    constructor({ title }) {
        _TestObject_title.set(this, void 0);
        this.parent = null;
        __classPrivateFieldSet(this, _TestObject_title, title, "f");
    }
    assign(src) {
        return Object.assign(this, src);
    }
    get title() {
        return __classPrivateFieldGet(this, _TestObject_title, "f");
    }
    titlePath() {
        if (this.parent) {
            const parentTitlePath = this.parent.titlePath();
            return this.title ? parentTitlePath.concat(this.title) : parentTitlePath;
        }
        return this.title ? [this.title] : [];
    }
    fullTitle() {
        return this.titlePath().join(" ");
    }
}
exports.TestObject = TestObject;
_TestObject_title = new WeakMap();
//# sourceMappingURL=test-object.js.map