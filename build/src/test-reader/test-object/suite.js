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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Suite_instances, _Suite_suites, _Suite_tests, _Suite_beforeEachHooks, _Suite_afterEachHooks, _Suite_addChild;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Suite = void 0;
const lodash_1 = __importDefault(require("lodash"));
const configurable_test_object_1 = require("./configurable-test-object");
const hook_1 = require("./hook");
class Suite extends configurable_test_object_1.ConfigurableTestObject {
    static create(opts) {
        return new this(opts);
    }
    // used inside test
    constructor({ title, file, id, location } = {}) {
        super({ title, file, id, location });
        _Suite_instances.add(this);
        _Suite_suites.set(this, void 0);
        _Suite_tests.set(this, void 0);
        _Suite_beforeEachHooks.set(this, void 0);
        _Suite_afterEachHooks.set(this, void 0);
        __classPrivateFieldSet(this, _Suite_suites, [], "f");
        __classPrivateFieldSet(this, _Suite_tests, [], "f");
        __classPrivateFieldSet(this, _Suite_beforeEachHooks, [], "f");
        __classPrivateFieldSet(this, _Suite_afterEachHooks, [], "f");
    }
    addSuite(suite) {
        return __classPrivateFieldGet(this, _Suite_instances, "m", _Suite_addChild).call(this, suite, __classPrivateFieldGet(this, _Suite_suites, "f"));
    }
    addTest(test) {
        return __classPrivateFieldGet(this, _Suite_instances, "m", _Suite_addChild).call(this, test, __classPrivateFieldGet(this, _Suite_tests, "f"));
    }
    addBeforeEachHook(hook) {
        return __classPrivateFieldGet(this, _Suite_instances, "m", _Suite_addChild).call(this, hook, __classPrivateFieldGet(this, _Suite_beforeEachHooks, "f"));
    }
    addAfterEachHook(hook) {
        return __classPrivateFieldGet(this, _Suite_instances, "m", _Suite_addChild).call(this, hook, __classPrivateFieldGet(this, _Suite_afterEachHooks, "f"));
    }
    beforeEach(fn) {
        return this.addBeforeEachHook(hook_1.Hook.create({ title: '"before each" hook', fn }));
    }
    afterEach(fn) {
        return this.addAfterEachHook(hook_1.Hook.create({ title: '"after each" hook', fn }));
    }
    eachTest(cb) {
        __classPrivateFieldGet(this, _Suite_tests, "f").forEach(t => cb(t));
        __classPrivateFieldGet(this, _Suite_suites, "f").forEach(s => s.eachTest(cb));
    }
    getTests() {
        return __classPrivateFieldGet(this, _Suite_tests, "f").concat(lodash_1.default.flatten(__classPrivateFieldGet(this, _Suite_suites, "f").map(s => s.getTests())));
    }
    // Modifies tree
    filterTests(cb) {
        __classPrivateFieldSet(this, _Suite_tests, __classPrivateFieldGet(this, _Suite_tests, "f").filter(cb), "f");
        __classPrivateFieldGet(this, _Suite_suites, "f").forEach(s => s.filterTests(cb));
        __classPrivateFieldSet(this, _Suite_suites, __classPrivateFieldGet(this, _Suite_suites, "f").filter(s => s.getTests().length !== 0), "f");
        return this;
    }
    get root() {
        return this.parent === null;
    }
    get suites() {
        return __classPrivateFieldGet(this, _Suite_suites, "f");
    }
    get tests() {
        return __classPrivateFieldGet(this, _Suite_tests, "f");
    }
    get beforeEachHooks() {
        return __classPrivateFieldGet(this, _Suite_beforeEachHooks, "f");
    }
    get afterEachHooks() {
        return __classPrivateFieldGet(this, _Suite_afterEachHooks, "f");
    }
}
exports.Suite = Suite;
_Suite_suites = new WeakMap(), _Suite_tests = new WeakMap(), _Suite_beforeEachHooks = new WeakMap(), _Suite_afterEachHooks = new WeakMap(), _Suite_instances = new WeakSet(), _Suite_addChild = function _Suite_addChild(child, storage) {
    child.parent = this;
    storage.push(child);
    return this;
};
//# sourceMappingURL=suite.js.map