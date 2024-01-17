"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _MochaEventBus_instances, _MochaEventBus_addRecursiveHandler;
const { EventEmitter } = require("events");
const Mocha = require("mocha");
const { EVENT_FILE_PRE_REQUIRE, EVENT_FILE_POST_REQUIRE, EVENT_SUITE_ADD_SUITE, EVENT_SUITE_ADD_TEST, EVENT_SUITE_ADD_HOOK_BEFORE_ALL, EVENT_SUITE_ADD_HOOK_AFTER_ALL, EVENT_SUITE_ADD_HOOK_BEFORE_EACH, EVENT_SUITE_ADD_HOOK_AFTER_EACH, } = Mocha.Suite.constants;
class MochaEventBus extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }
    constructor(rootSuite) {
        super();
        _MochaEventBus_instances.add(this);
        rootSuite.setMaxListeners(0);
        __classPrivateFieldGet(this, _MochaEventBus_instances, "m", _MochaEventBus_addRecursiveHandler).call(this, rootSuite, EVENT_SUITE_ADD_SUITE, suite => suite.setMaxListeners(0));
        [EVENT_FILE_PRE_REQUIRE, EVENT_FILE_POST_REQUIRE].forEach(event => {
            rootSuite.on(event, (...args) => this.emit(event, ...args));
        });
        [
            EVENT_SUITE_ADD_SUITE,
            EVENT_SUITE_ADD_TEST,
            EVENT_SUITE_ADD_HOOK_BEFORE_ALL,
            EVENT_SUITE_ADD_HOOK_AFTER_ALL,
            EVENT_SUITE_ADD_HOOK_BEFORE_EACH,
            EVENT_SUITE_ADD_HOOK_AFTER_EACH,
        ].forEach(event => {
            __classPrivateFieldGet(this, _MochaEventBus_instances, "m", _MochaEventBus_addRecursiveHandler).call(this, rootSuite, event, (...args) => this.emit(event, ...args));
        });
    }
}
_MochaEventBus_instances = new WeakSet(), _MochaEventBus_addRecursiveHandler = function _MochaEventBus_addRecursiveHandler(suite, event, cb) {
    suite.on(EVENT_SUITE_ADD_SUITE, subSuite => __classPrivateFieldGet(this, _MochaEventBus_instances, "m", _MochaEventBus_addRecursiveHandler).call(this, subSuite, event, cb));
    suite.on(event, cb);
};
MochaEventBus.events = Mocha.Suite.constants;
module.exports = {
    MochaEventBus,
};
//# sourceMappingURL=mocha-event-bus.js.map