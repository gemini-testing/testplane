"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
var _SetsBuilder_instances, _SetsBuilder_sets, _SetsBuilder_filesToUse, _SetsBuilder_validateUnknownSets, _SetsBuilder_transformDirsToMasks, _SetsBuilder_getSets, _SetsBuilder_resolvePaths, _SetsBuilder_validateFoundFiles, _SetsBuilder_useFiles, _SetsBuilder_expandFiles, _SetsBuilder_hasFiles;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetsBuilder = void 0;
const path_1 = __importDefault(require("path"));
const lodash_1 = __importDefault(require("lodash"));
const globExtra = __importStar(require("../../bundle/glob-extra"));
const set_collection_1 = require("./set-collection");
const test_set_1 = require("./test-set");
const FILE_EXTENSIONS = [".js", ".mjs"];
class SetsBuilder {
    static create(sets, opts) {
        return new SetsBuilder(sets, opts);
    }
    constructor(sets, opts) {
        _SetsBuilder_instances.add(this);
        _SetsBuilder_sets.set(this, void 0);
        _SetsBuilder_filesToUse.set(this, void 0);
        __classPrivateFieldSet(this, _SetsBuilder_sets, lodash_1.default.mapValues(sets, set => test_set_1.TestSet.create(set)), "f");
        __classPrivateFieldSet(this, _SetsBuilder_filesToUse, __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_hasFiles).call(this) ? [] : opts.defaultPaths, "f");
    }
    useSets(setsToUse) {
        __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_validateUnknownSets).call(this, setsToUse);
        if (!lodash_1.default.isEmpty(setsToUse)) {
            __classPrivateFieldSet(this, _SetsBuilder_sets, lodash_1.default.pick(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), setsToUse), "f");
        }
        return this;
    }
    useFiles(files) {
        if (!lodash_1.default.isEmpty(files)) {
            __classPrivateFieldSet(this, _SetsBuilder_filesToUse, files, "f");
        }
        return this;
    }
    useBrowsers(browsers) {
        lodash_1.default.forEach(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), set => set.useBrowsers(browsers));
        return this;
    }
    build(projectRoot, globOpts = {}, fileExtensions = FILE_EXTENSIONS) {
        const expandOpts = { formats: fileExtensions, root: projectRoot };
        if (globOpts.ignore) {
            globOpts.ignore = []
                .concat(globOpts.ignore)
                .map(ignorePattern => path_1.default.resolve(projectRoot, ignorePattern));
        }
        return __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_transformDirsToMasks).call(this)
            .then(() => __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_resolvePaths).call(this, projectRoot))
            .then(() => globExtra.expandPaths(__classPrivateFieldGet(this, _SetsBuilder_filesToUse, "f"), expandOpts, globOpts))
            .then(expandedFiles => {
            __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_validateFoundFiles).call(this, expandedFiles);
            __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_useFiles).call(this, expandedFiles);
        })
            .then(() => __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_expandFiles).call(this, expandOpts, globOpts))
            .then(() => set_collection_1.SetCollection.create(__classPrivateFieldGet(this, _SetsBuilder_sets, "f")));
    }
}
exports.SetsBuilder = SetsBuilder;
_SetsBuilder_sets = new WeakMap(), _SetsBuilder_filesToUse = new WeakMap(), _SetsBuilder_instances = new WeakSet(), _SetsBuilder_validateUnknownSets = function _SetsBuilder_validateUnknownSets(setsToUse) {
    const setsNames = lodash_1.default.keys(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"));
    const unknownSets = lodash_1.default.difference(setsToUse, setsNames);
    if (lodash_1.default.isEmpty(unknownSets)) {
        return;
    }
    let error = `No such sets: ${unknownSets.join(", ")}.`;
    if (!lodash_1.default.isEmpty(setsNames)) {
        error += ` Use one of the specified sets: ${setsNames.join(", ")}`;
    }
    throw new Error(error);
}, _SetsBuilder_transformDirsToMasks = function _SetsBuilder_transformDirsToMasks() {
    return Promise.all(__classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_getSets).call(this).map(set => set.transformDirsToMasks()));
}, _SetsBuilder_getSets = function _SetsBuilder_getSets() {
    return lodash_1.default.values(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"));
}, _SetsBuilder_resolvePaths = function _SetsBuilder_resolvePaths(projectRoot) {
    lodash_1.default.forEach(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), set => set.resolveFiles(projectRoot));
}, _SetsBuilder_validateFoundFiles = function _SetsBuilder_validateFoundFiles(foundFiles) {
    if (!lodash_1.default.isEmpty(__classPrivateFieldGet(this, _SetsBuilder_filesToUse, "f")) && lodash_1.default.isEmpty(foundFiles)) {
        const paths = [].concat(__classPrivateFieldGet(this, _SetsBuilder_filesToUse, "f")).join(", ");
        throw new Error(`Cannot find files by specified paths: ${paths}`);
    }
}, _SetsBuilder_useFiles = function _SetsBuilder_useFiles(filesToUse) {
    lodash_1.default.forEach(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), set => set.useFiles(filesToUse));
    if (!__classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_hasFiles).call(this)) {
        throw new Error("Cannot find files by masks in sets");
    }
}, _SetsBuilder_expandFiles = function _SetsBuilder_expandFiles(expandOpts, globOpts) {
    return Promise.all(__classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_getSets).call(this).map(set => set.expandFiles(expandOpts, globOpts)));
}, _SetsBuilder_hasFiles = function _SetsBuilder_hasFiles() {
    return lodash_1.default.some(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), set => !lodash_1.default.isEmpty(set.getFiles()));
};
//# sourceMappingURL=index.js.map