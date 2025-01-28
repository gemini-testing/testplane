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
var _SetCollection_instances, _SetCollection_sets, _SetCollection_getBrowsersForFile, _SetCollection_getBrowsers, _SetCollection_getFilesForBrowser, _SetCollection_getFromSets;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetCollection = void 0;
const lodash_1 = __importDefault(require("lodash"));
class SetCollection {
    static create(sets) {
        return new SetCollection(sets);
    }
    constructor(sets) {
        _SetCollection_instances.add(this);
        _SetCollection_sets.set(this, void 0);
        __classPrivateFieldSet(this, _SetCollection_sets, sets, "f");
    }
    groupByFile() {
        const files = this.getAllFiles();
        const browsers = files.map(file => __classPrivateFieldGet(this, _SetCollection_instances, "m", _SetCollection_getBrowsersForFile).call(this, file));
        return lodash_1.default.zipObject(files, browsers);
    }
    getAllFiles() {
        return lodash_1.default.uniq(__classPrivateFieldGet(this, _SetCollection_instances, "m", _SetCollection_getFromSets).call(this, set => set.getFiles()));
    }
    groupByBrowser() {
        const browsers = __classPrivateFieldGet(this, _SetCollection_instances, "m", _SetCollection_getBrowsers).call(this);
        const files = browsers.map(browser => __classPrivateFieldGet(this, _SetCollection_instances, "m", _SetCollection_getFilesForBrowser).call(this, browser));
        return lodash_1.default.zipObject(browsers, files);
    }
}
exports.SetCollection = SetCollection;
_SetCollection_sets = new WeakMap(), _SetCollection_instances = new WeakSet(), _SetCollection_getBrowsersForFile = function _SetCollection_getBrowsersForFile(path) {
    return __classPrivateFieldGet(this, _SetCollection_instances, "m", _SetCollection_getFromSets).call(this, set => set.getBrowsersForFile(path));
}, _SetCollection_getBrowsers = function _SetCollection_getBrowsers() {
    return __classPrivateFieldGet(this, _SetCollection_instances, "m", _SetCollection_getFromSets).call(this, set => set.getBrowsers());
}, _SetCollection_getFilesForBrowser = function _SetCollection_getFilesForBrowser(browser) {
    return __classPrivateFieldGet(this, _SetCollection_instances, "m", _SetCollection_getFromSets).call(this, set => set.getFilesForBrowser(browser));
}, _SetCollection_getFromSets = function _SetCollection_getFromSets(cb) {
    return (0, lodash_1.default)(__classPrivateFieldGet(this, _SetCollection_sets, "f")).map(cb).flatten().uniq().value();
};
//# sourceMappingURL=set-collection.js.map