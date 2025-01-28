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
var _TestSet_set;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestSet = void 0;
const lodash_1 = __importDefault(require("lodash"));
const micromatch_1 = __importDefault(require("micromatch"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const globExtra = __importStar(require("../../bundle/glob-extra"));
class TestSet {
    static create(set) {
        return new TestSet(set);
    }
    constructor(set) {
        _TestSet_set.set(this, void 0);
        __classPrivateFieldSet(this, _TestSet_set, lodash_1.default.clone(set), "f");
    }
    async expandFiles(expandOpts, globOpts = {}) {
        const { files, ignoreFiles = [] } = __classPrivateFieldGet(this, _TestSet_set, "f");
        globOpts = lodash_1.default.clone(globOpts);
        globOpts.ignore = []
            .concat(globOpts.ignore || [], ignoreFiles)
            .map(p => path_1.default.resolve(expandOpts.root, p));
        return globExtra
            .expandPaths(files, expandOpts, globOpts)
            .then(expandedFiles => (__classPrivateFieldSet(this, _TestSet_set, lodash_1.default.extend(__classPrivateFieldGet(this, _TestSet_set, "f"), { files: expandedFiles }), "f")));
    }
    async transformDirsToMasks() {
        return Promise.all(__classPrivateFieldGet(this, _TestSet_set, "f").files.map(file => {
            if (globExtra.isMask(file)) {
                return file;
            }
            return promises_1.default
                .stat(file)
                .then(stat => (stat.isDirectory() ? path_1.default.join(file, "**") : file))
                .catch(() => Promise.reject(new Error(`Cannot read such file or directory: '${file}'`)));
        })).then(files => (__classPrivateFieldGet(this, _TestSet_set, "f").files = files));
    }
    resolveFiles(projectRoot) {
        __classPrivateFieldGet(this, _TestSet_set, "f").files = __classPrivateFieldGet(this, _TestSet_set, "f").files.map(file => path_1.default.resolve(projectRoot, file));
    }
    getFiles() {
        return __classPrivateFieldGet(this, _TestSet_set, "f").files;
    }
    getBrowsers() {
        return __classPrivateFieldGet(this, _TestSet_set, "f").browsers;
    }
    getFilesForBrowser(browser) {
        return lodash_1.default.includes(__classPrivateFieldGet(this, _TestSet_set, "f").browsers, browser) ? __classPrivateFieldGet(this, _TestSet_set, "f").files : [];
    }
    getBrowsersForFile(file) {
        return lodash_1.default.includes(__classPrivateFieldGet(this, _TestSet_set, "f").files, file) ? __classPrivateFieldGet(this, _TestSet_set, "f").browsers : [];
    }
    useFiles(files) {
        if (lodash_1.default.isEmpty(files)) {
            return;
        }
        __classPrivateFieldGet(this, _TestSet_set, "f").files = lodash_1.default.isEmpty(__classPrivateFieldGet(this, _TestSet_set, "f").files) ? files : (0, micromatch_1.default)(files, __classPrivateFieldGet(this, _TestSet_set, "f").files);
    }
    useBrowsers(browsers) {
        __classPrivateFieldGet(this, _TestSet_set, "f").browsers = lodash_1.default.isEmpty(browsers) ? __classPrivateFieldGet(this, _TestSet_set, "f").browsers : lodash_1.default.intersection(__classPrivateFieldGet(this, _TestSet_set, "f").browsers, browsers);
    }
}
exports.TestSet = TestSet;
_TestSet_set = new WeakMap();
//# sourceMappingURL=test-set.js.map