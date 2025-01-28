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
var _TestParserAPI_ctx, _TestParserAPI_eventBus;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestParserAPI = void 0;
const events_1 = require("../events");
class TestParserAPI {
    static create(ctx, eventBus) {
        return new this(ctx, eventBus);
    }
    constructor(ctx, eventBus) {
        _TestParserAPI_ctx.set(this, void 0);
        _TestParserAPI_eventBus.set(this, void 0);
        __classPrivateFieldSet(this, _TestParserAPI_ctx, ctx, "f");
        __classPrivateFieldSet(this, _TestParserAPI_eventBus, eventBus, "f");
    }
    setController(namespace, methods) {
        __classPrivateFieldGet(this, _TestParserAPI_ctx, "f")[namespace] = {};
        Object.entries(methods).forEach(([cbName, cb]) => {
            __classPrivateFieldGet(this, _TestParserAPI_ctx, "f")[namespace][cbName] = (...args) => {
                __classPrivateFieldGet(this, _TestParserAPI_eventBus, "f").emit(events_1.TestReaderEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
                    treeBuilder.addTrap((obj) => cb.call(obj, ...args));
                });
                return __classPrivateFieldGet(this, _TestParserAPI_ctx, "f")[namespace];
            };
        });
    }
}
exports.TestParserAPI = TestParserAPI;
_TestParserAPI_ctx = new WeakMap(), _TestParserAPI_eventBus = new WeakMap();
//# sourceMappingURL=test-parser-api.js.map