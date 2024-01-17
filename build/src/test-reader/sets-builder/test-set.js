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
var _TestSet_set, _a;
const globExtra = require("glob-extra");
const _ = require("lodash");
const mm = require("micromatch");
const path = require("path");
const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs"));
module.exports = (_a = class TestSet {
        static create(set) {
            return new _a(set);
        }
        constructor(set) {
            _TestSet_set.set(this, void 0);
            __classPrivateFieldSet(this, _TestSet_set, _.clone(set), "f");
        }
        expandFiles(expandOpts, globOpts = {}) {
            const { files, ignoreFiles = [] } = __classPrivateFieldGet(this, _TestSet_set, "f");
            globOpts = _.clone(globOpts);
            globOpts.ignore = [].concat(globOpts.ignore || [], ignoreFiles).map(p => path.resolve(expandOpts.root, p));
            return globExtra
                .expandPaths(files, expandOpts, globOpts)
                .then(expandedFiles => (__classPrivateFieldSet(this, _TestSet_set, _.extend(__classPrivateFieldGet(this, _TestSet_set, "f"), { files: expandedFiles }), "f")));
        }
        transformDirsToMasks() {
            return Promise.map(__classPrivateFieldGet(this, _TestSet_set, "f").files, file => {
                if (globExtra.isMask(file)) {
                    return file;
                }
                return fs
                    .statAsync(file)
                    .then(stat => (stat.isDirectory() ? path.join(file, "**") : file))
                    .catch(() => Promise.reject(new Error(`Cannot read such file or directory: '${file}'`)));
            }).then(files => (__classPrivateFieldGet(this, _TestSet_set, "f").files = files));
        }
        resolveFiles(projectRoot) {
            __classPrivateFieldGet(this, _TestSet_set, "f").files = __classPrivateFieldGet(this, _TestSet_set, "f").files.map(file => path.resolve(projectRoot, file));
        }
        getFiles() {
            return __classPrivateFieldGet(this, _TestSet_set, "f").files;
        }
        getBrowsers() {
            return __classPrivateFieldGet(this, _TestSet_set, "f").browsers;
        }
        getFilesForBrowser(browser) {
            return _.includes(__classPrivateFieldGet(this, _TestSet_set, "f").browsers, browser) ? __classPrivateFieldGet(this, _TestSet_set, "f").files : [];
        }
        getBrowsersForFile(file) {
            return _.includes(__classPrivateFieldGet(this, _TestSet_set, "f").files, file) ? __classPrivateFieldGet(this, _TestSet_set, "f").browsers : [];
        }
        useFiles(files) {
            if (_.isEmpty(files)) {
                return;
            }
            __classPrivateFieldGet(this, _TestSet_set, "f").files = _.isEmpty(__classPrivateFieldGet(this, _TestSet_set, "f").files) ? files : mm(files, __classPrivateFieldGet(this, _TestSet_set, "f").files);
        }
        useBrowsers(browsers) {
            __classPrivateFieldGet(this, _TestSet_set, "f").browsers = _.isEmpty(browsers) ? __classPrivateFieldGet(this, _TestSet_set, "f").browsers : _.intersection(__classPrivateFieldGet(this, _TestSet_set, "f").browsers, browsers);
        }
    },
    _TestSet_set = new WeakMap(),
    _a);
//# sourceMappingURL=test-set.js.map