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
var _TestCollection_instances, _TestCollection_specs, _TestCollection_originalSpecs, _TestCollection_getRoot, _TestCollection_mkDisabledTest, _TestCollection_findTestIndex;
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
class TestCollection {
    static create(specs) {
        return new this(specs);
    }
    constructor(specs) {
        _TestCollection_instances.add(this);
        _TestCollection_specs.set(this, void 0);
        _TestCollection_originalSpecs.set(this, void 0);
        __classPrivateFieldSet(this, _TestCollection_originalSpecs, specs, "f");
        __classPrivateFieldSet(this, _TestCollection_specs, lodash_1.default.mapValues(specs, lodash_1.default.clone), "f");
    }
    getRootSuite(browserId) {
        const test = __classPrivateFieldGet(this, _TestCollection_originalSpecs, "f")[browserId][0];
        return test && test.parent && __classPrivateFieldGet(this, _TestCollection_instances, "m", _TestCollection_getRoot).call(this, test.parent);
    }
    eachRootSuite(cb) {
        lodash_1.default.forEach(__classPrivateFieldGet(this, _TestCollection_specs, "f"), (_, browserId) => {
            const root = this.getRootSuite(browserId);
            if (root) {
                cb(root, browserId);
            }
        });
    }
    getBrowsers() {
        return Object.keys(__classPrivateFieldGet(this, _TestCollection_specs, "f"));
    }
    mapTests(browserId, cb) {
        if (lodash_1.default.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }
        const results = [];
        this.eachTest(browserId, (test, browserId) => results.push(cb(test, browserId)));
        return results;
    }
    sortTests(browserId, cb) {
        var _a, _b;
        if (lodash_1.default.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }
        if (browserId) {
            if (((_a = __classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId]) === null || _a === void 0 ? void 0 : _a.length) && ((_b = __classPrivateFieldGet(this, _TestCollection_originalSpecs, "f")[browserId]) === null || _b === void 0 ? void 0 : _b.length)) {
                const pairs = lodash_1.default.zip(__classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId], __classPrivateFieldGet(this, _TestCollection_originalSpecs, "f")[browserId]);
                pairs.sort((p1, p2) => cb(p1[0], p2[0]));
                [__classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId], __classPrivateFieldGet(this, _TestCollection_originalSpecs, "f")[browserId]] = lodash_1.default.unzip(pairs);
            }
        }
        else {
            this.getBrowsers().forEach(browserId => this.sortTests(browserId, cb));
        }
        return this;
    }
    eachTest(browserId, cb) {
        if (lodash_1.default.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }
        if (browserId) {
            __classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId].forEach(test => cb(test, browserId));
        }
        else {
            this.getBrowsers().forEach(browserId => this.eachTest(browserId, cb));
        }
    }
    eachTestByVersions(browserId, cb) {
        const groups = lodash_1.default.groupBy(__classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId], "browserVersion");
        const versions = Object.keys(groups);
        const maxLength = (0, lodash_1.default)(groups)
            .map(tests => tests.length)
            .max() || 0;
        for (let idx = 0; idx < maxLength; ++idx) {
            for (const version of versions) {
                const group = groups[version];
                const test = group[idx];
                if (test) {
                    cb(test, browserId, test.browserVersion);
                }
            }
        }
    }
    disableAll(browserId) {
        if (browserId) {
            __classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId] = __classPrivateFieldGet(this, _TestCollection_originalSpecs, "f")[browserId].map(test => __classPrivateFieldGet(this, _TestCollection_instances, "m", _TestCollection_mkDisabledTest).call(this, test));
        }
        else {
            this.getBrowsers().forEach(browserId => this.disableAll(browserId));
        }
        return this;
    }
    disableTest(fullTitle, browserId) {
        if (browserId) {
            const idx = __classPrivateFieldGet(this, _TestCollection_instances, "m", _TestCollection_findTestIndex).call(this, fullTitle, browserId);
            if (idx !== -1) {
                __classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId].splice(idx, 1, __classPrivateFieldGet(this, _TestCollection_instances, "m", _TestCollection_mkDisabledTest).call(this, __classPrivateFieldGet(this, _TestCollection_originalSpecs, "f")[browserId][idx]));
            }
        }
        else {
            this.getBrowsers().forEach(browserId => this.disableTest(fullTitle, browserId));
        }
        return this;
    }
    enableAll(browserId) {
        if (browserId) {
            __classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId] = lodash_1.default.clone(__classPrivateFieldGet(this, _TestCollection_originalSpecs, "f")[browserId]);
        }
        else {
            this.getBrowsers().forEach(browserId => this.enableAll(browserId));
        }
        return this;
    }
    enableTest(fullTitle, browserId) {
        if (browserId) {
            const idx = __classPrivateFieldGet(this, _TestCollection_instances, "m", _TestCollection_findTestIndex).call(this, fullTitle, browserId);
            if (idx !== -1) {
                __classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId].splice(idx, 1, __classPrivateFieldGet(this, _TestCollection_originalSpecs, "f")[browserId][idx]);
            }
        }
        else {
            this.getBrowsers().forEach(browserId => this.enableTest(fullTitle, browserId));
        }
        return this;
    }
}
exports.default = TestCollection;
_TestCollection_specs = new WeakMap(), _TestCollection_originalSpecs = new WeakMap(), _TestCollection_instances = new WeakSet(), _TestCollection_getRoot = function _TestCollection_getRoot(suite) {
    return suite.root ? suite : __classPrivateFieldGet(this, _TestCollection_instances, "m", _TestCollection_getRoot).call(this, suite.parent);
}, _TestCollection_mkDisabledTest = function _TestCollection_mkDisabledTest(test) {
    return lodash_1.default.extend(test.clone(), { disabled: true });
}, _TestCollection_findTestIndex = function _TestCollection_findTestIndex(fullTitle, browserId) {
    return __classPrivateFieldGet(this, _TestCollection_specs, "f")[browserId].findIndex(test => test.fullTitle() === fullTitle);
};
//# sourceMappingURL=test-collection.js.map