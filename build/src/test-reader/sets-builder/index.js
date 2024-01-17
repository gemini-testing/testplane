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
var _SetsBuilder_instances, _SetsBuilder_sets, _SetsBuilder_filesToUse, _SetsBuilder_validateUnknownSets, _SetsBuilder_transformDirsToMasks, _SetsBuilder_getSets, _SetsBuilder_resolvePaths, _SetsBuilder_validateFoundFiles, _SetsBuilder_useFiles, _SetsBuilder_expandFiles, _SetsBuilder_hasFiles, _a;
const path = require("path");
const globExtra = require("glob-extra");
const _ = require("lodash");
const Promise = require("bluebird");
const SetCollection = require("./set-collection");
const TestSet = require("./test-set");
const FILE_EXTENSIONS = [".js", ".mjs"];
module.exports = (_a = class SetsBuilder {
        static create(sets, opts) {
            return new _a(sets, opts);
        }
        constructor(sets, opts) {
            _SetsBuilder_instances.add(this);
            _SetsBuilder_sets.set(this, void 0);
            _SetsBuilder_filesToUse.set(this, void 0);
            __classPrivateFieldSet(this, _SetsBuilder_sets, _.mapValues(sets, set => TestSet.create(set)), "f");
            __classPrivateFieldSet(this, _SetsBuilder_filesToUse, __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_hasFiles).call(this) ? [] : [opts.defaultDir], "f");
        }
        useSets(setsToUse) {
            __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_validateUnknownSets).call(this, setsToUse);
            if (!_.isEmpty(setsToUse)) {
                __classPrivateFieldSet(this, _SetsBuilder_sets, _.pick(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), setsToUse), "f");
            }
            return this;
        }
        useFiles(files) {
            if (!_.isEmpty(files)) {
                __classPrivateFieldSet(this, _SetsBuilder_filesToUse, files, "f");
            }
            return this;
        }
        useBrowsers(browsers) {
            _.forEach(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), set => set.useBrowsers(browsers));
            return this;
        }
        build(projectRoot, globOpts = {}, fileExtensions = FILE_EXTENSIONS) {
            const expandOpts = { formats: fileExtensions, root: projectRoot };
            if (globOpts.ignore) {
                globOpts.ignore = [].concat(globOpts.ignore).map(ignorePattern => path.resolve(projectRoot, ignorePattern));
            }
            return __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_transformDirsToMasks).call(this)
                .then(() => __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_resolvePaths).call(this, projectRoot))
                .then(() => globExtra.expandPaths(__classPrivateFieldGet(this, _SetsBuilder_filesToUse, "f"), expandOpts, globOpts))
                .then(expandedFiles => {
                __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_validateFoundFiles).call(this, expandedFiles);
                __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_useFiles).call(this, expandedFiles);
            })
                .then(() => __classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_expandFiles).call(this, expandOpts, globOpts))
                .then(() => SetCollection.create(__classPrivateFieldGet(this, _SetsBuilder_sets, "f")));
        }
    },
    _SetsBuilder_sets = new WeakMap(),
    _SetsBuilder_filesToUse = new WeakMap(),
    _SetsBuilder_instances = new WeakSet(),
    _SetsBuilder_validateUnknownSets = function _SetsBuilder_validateUnknownSets(setsToUse) {
        const setsNames = _.keys(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"));
        const unknownSets = _.difference(setsToUse, setsNames);
        if (_.isEmpty(unknownSets)) {
            return;
        }
        let error = `No such sets: ${unknownSets.join(", ")}.`;
        if (!_.isEmpty(setsNames)) {
            error += ` Use one of the specified sets: ${setsNames.join(", ")}`;
        }
        throw new Error(error);
    },
    _SetsBuilder_transformDirsToMasks = function _SetsBuilder_transformDirsToMasks() {
        return Promise.map(__classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_getSets).call(this), set => set.transformDirsToMasks());
    },
    _SetsBuilder_getSets = function _SetsBuilder_getSets() {
        return _.values(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"));
    },
    _SetsBuilder_resolvePaths = function _SetsBuilder_resolvePaths(projectRoot) {
        _.forEach(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), set => set.resolveFiles(projectRoot));
    },
    _SetsBuilder_validateFoundFiles = function _SetsBuilder_validateFoundFiles(foundFiles) {
        if (!_.isEmpty(__classPrivateFieldGet(this, _SetsBuilder_filesToUse, "f")) && _.isEmpty(foundFiles)) {
            const paths = [].concat(__classPrivateFieldGet(this, _SetsBuilder_filesToUse, "f")).join(", ");
            throw new Error(`Cannot find files by specified paths: ${paths}`);
        }
    },
    _SetsBuilder_useFiles = function _SetsBuilder_useFiles(filesToUse) {
        _.forEach(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), set => set.useFiles(filesToUse));
        if (!__classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_hasFiles).call(this)) {
            throw new Error("Cannot find files by masks in sets");
        }
    },
    _SetsBuilder_expandFiles = function _SetsBuilder_expandFiles(expandOpts, globOpts) {
        return Promise.map(__classPrivateFieldGet(this, _SetsBuilder_instances, "m", _SetsBuilder_getSets).call(this), set => set.expandFiles(expandOpts, globOpts));
    },
    _SetsBuilder_hasFiles = function _SetsBuilder_hasFiles() {
        return _.some(__classPrivateFieldGet(this, _SetsBuilder_sets, "f"), set => !_.isEmpty(set.getFiles()));
    },
    _a);
//# sourceMappingURL=index.js.map