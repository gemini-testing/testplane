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
var _TreeBuilderDecorator_instances, _TreeBuilderDecorator_treeBuilder, _TreeBuilderDecorator_suiteMap, _TreeBuilderDecorator_suiteCounter, _TreeBuilderDecorator_addHook, _TreeBuilderDecorator_mkTestObject, _TreeBuilderDecorator_applyConfig, _TreeBuilderDecorator_getParent;
const { Suite, Test, Hook } = require("../test-object");
const crypto = require("../../utils/crypto");
const { computeFile } = require("./utils");
class TreeBuilderDecorator {
    static create(...args) {
        return new this(...args);
    }
    constructor(treeBuilder) {
        _TreeBuilderDecorator_instances.add(this);
        _TreeBuilderDecorator_treeBuilder.set(this, void 0);
        _TreeBuilderDecorator_suiteMap.set(this, void 0);
        _TreeBuilderDecorator_suiteCounter.set(this, void 0);
        __classPrivateFieldSet(this, _TreeBuilderDecorator_treeBuilder, treeBuilder, "f");
        __classPrivateFieldSet(this, _TreeBuilderDecorator_suiteMap, new Map(), "f");
        __classPrivateFieldSet(this, _TreeBuilderDecorator_suiteCounter, new Map(), "f");
    }
    addSuite(mochaSuite) {
        const { id: mochaId } = mochaSuite;
        const file = computeFile(mochaSuite) ?? "unknown-file";
        const positionInFile = __classPrivateFieldGet(this, _TreeBuilderDecorator_suiteCounter, "f").get(file) || 0;
        const id = mochaSuite.root ? mochaId : crypto.getShortMD5(file) + positionInFile;
        const suite = __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_mkTestObject).call(this, Suite, mochaSuite, { id });
        __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_applyConfig).call(this, suite, mochaSuite);
        __classPrivateFieldGet(this, _TreeBuilderDecorator_treeBuilder, "f").addSuite(suite, __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_getParent).call(this, mochaSuite, null));
        __classPrivateFieldGet(this, _TreeBuilderDecorator_suiteMap, "f").set(mochaId, suite);
        __classPrivateFieldGet(this, _TreeBuilderDecorator_suiteCounter, "f").set(file, positionInFile + 1);
        return this;
    }
    addTest(mochaTest) {
        const { fn } = mochaTest;
        const id = crypto.getShortMD5(mochaTest.fullTitle());
        const test = __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_mkTestObject).call(this, Test, mochaTest, { id, fn });
        __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_applyConfig).call(this, test, mochaTest);
        __classPrivateFieldGet(this, _TreeBuilderDecorator_treeBuilder, "f").addTest(test, __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_getParent).call(this, mochaTest));
        return this;
    }
    addBeforeEachHook(mochaHook) {
        return __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_addHook).call(this, mochaHook, (hook, parent) => __classPrivateFieldGet(this, _TreeBuilderDecorator_treeBuilder, "f").addBeforeEachHook(hook, parent));
    }
    addAfterEachHook(mochaHook) {
        return __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_addHook).call(this, mochaHook, (hook, parent) => __classPrivateFieldGet(this, _TreeBuilderDecorator_treeBuilder, "f").addAfterEachHook(hook, parent));
    }
    addTrap(fn) {
        __classPrivateFieldGet(this, _TreeBuilderDecorator_treeBuilder, "f").addTrap(fn);
        return this;
    }
    addTestFilter(fn) {
        __classPrivateFieldGet(this, _TreeBuilderDecorator_treeBuilder, "f").addTestFilter(fn);
        return this;
    }
    applyFilters() {
        __classPrivateFieldGet(this, _TreeBuilderDecorator_treeBuilder, "f").applyFilters();
        return this;
    }
    getRootSuite() {
        return __classPrivateFieldGet(this, _TreeBuilderDecorator_treeBuilder, "f").getRootSuite();
    }
}
_TreeBuilderDecorator_treeBuilder = new WeakMap(), _TreeBuilderDecorator_suiteMap = new WeakMap(), _TreeBuilderDecorator_suiteCounter = new WeakMap(), _TreeBuilderDecorator_instances = new WeakSet(), _TreeBuilderDecorator_addHook = function _TreeBuilderDecorator_addHook(mochaHook, cb) {
    const { fn, title } = mochaHook;
    const hook = Hook.create({ fn, title });
    cb(hook, __classPrivateFieldGet(this, _TreeBuilderDecorator_instances, "m", _TreeBuilderDecorator_getParent).call(this, mochaHook));
    return this;
}, _TreeBuilderDecorator_mkTestObject = function _TreeBuilderDecorator_mkTestObject(Constructor, mochaObject, customOpts) {
    const { title, file, location } = mochaObject;
    return Constructor.create({ title, file, location, ...customOpts });
}, _TreeBuilderDecorator_applyConfig = function _TreeBuilderDecorator_applyConfig(testObject, mochaObject) {
    const { pending, parent } = mochaObject;
    if (!parent || mochaObject.timeout() !== parent.timeout()) {
        testObject.timeout = mochaObject.timeout();
    }
    if (pending) {
        testObject.skip({ reason: "Skipped by mocha interface" });
    }
}, _TreeBuilderDecorator_getParent = function _TreeBuilderDecorator_getParent({ parent }, defaultValue) {
    if (!parent) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error("Parent not set");
    }
    return __classPrivateFieldGet(this, _TreeBuilderDecorator_suiteMap, "f").get(parent.id);
};
module.exports = {
    TreeBuilderDecorator,
};
//# sourceMappingURL=tree-builder-decorator.js.map