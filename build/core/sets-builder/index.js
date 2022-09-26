"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bluebird_1 = __importDefault(require("bluebird"));
const glob_extra_1 = __importDefault(require("glob-extra"));
const lodash_1 = __importDefault(require("lodash"));
const path_1 = __importDefault(require("path"));
const set_collection_1 = __importDefault(require("./set-collection"));
const test_set_1 = __importDefault(require("./test-set"));
const FILE_EXTENSIONS = ['.js'];
class SetsBuilder {
    constructor(sets, opts) {
        this._sets = lodash_1.default.mapValues(sets, (set) => test_set_1.default.create(set));
        this._defaultDir = opts.defaultDir;
        this._filesToUse = this._hasFiles() ? [] : [this._defaultDir];
    }
    static create(sets, opts) {
        return new SetsBuilder(sets, opts);
    }
    useSets(setsToUse) {
        this._validateUnknownSets(setsToUse);
        if (!lodash_1.default.isEmpty(setsToUse)) {
            this._sets = lodash_1.default.pick(this._sets, setsToUse);
        }
        return this;
    }
    _validateUnknownSets(setsToUse) {
        const setsNames = lodash_1.default.keys(this._sets);
        const unknownSets = lodash_1.default.difference(setsToUse, setsNames);
        if (lodash_1.default.isEmpty(unknownSets)) {
            return;
        }
        let error = `No such sets: ${unknownSets.join(', ')}.`;
        if (!lodash_1.default.isEmpty(setsNames)) {
            error += ` Use one of the specified sets: ${setsNames.join(', ')}`;
        }
        throw new Error(error);
    }
    useFiles(files) {
        if (!lodash_1.default.isEmpty(files)) {
            this._filesToUse = files;
        }
        return this;
    }
    useBrowsers(browsers) {
        lodash_1.default.forEach(this._sets, (set) => set.useBrowsers(browsers));
        return this;
    }
    async build(projectRoot, globOpts = {}, fileExtensions = FILE_EXTENSIONS) {
        const expandOpts = { formats: fileExtensions, root: projectRoot };
        if (globOpts.ignore) {
            globOpts.ignore = [].concat(globOpts.ignore)
                .map((ignorePattern) => path_1.default.resolve(projectRoot, ignorePattern));
        }
        await this._transformDirsToMasks();
        this._resolvePaths(projectRoot);
        const expandedFiles = await glob_extra_1.default.expandPaths(this._filesToUse, expandOpts, globOpts);
        this._validateFoundFiles(expandedFiles);
        this._useFiles(expandedFiles);
        await this._expandFiles(expandOpts, globOpts);
        return set_collection_1.default.create(this._sets);
    }
    _transformDirsToMasks() {
        return bluebird_1.default.map(this._getSets(), (set) => set.transformDirsToMasks());
    }
    _getSets() {
        return lodash_1.default.values(this._sets);
    }
    _resolvePaths(projectRoot) {
        lodash_1.default.forEach(this._sets, (set) => set.resolveFiles(projectRoot));
    }
    _validateFoundFiles(foundFiles) {
        if (!lodash_1.default.isEmpty(this._filesToUse) && lodash_1.default.isEmpty(foundFiles)) {
            const paths = [].concat(this._filesToUse).join(', ');
            throw new Error(`Cannot find files by specified paths: ${paths}`);
        }
    }
    _useFiles(filesToUse) {
        lodash_1.default.forEach(this._sets, (set) => set.useFiles(filesToUse));
        if (!this._hasFiles()) {
            throw new Error('Cannot find files by masks in sets');
        }
    }
    _expandFiles(expandOpts, globOpts) {
        return bluebird_1.default.map(this._getSets(), (set) => set.expandFiles(expandOpts, globOpts));
    }
    _hasFiles() {
        return lodash_1.default.some(this._sets, (set) => !lodash_1.default.isEmpty(set.getFiles()));
    }
}
exports.default = SetsBuilder;
