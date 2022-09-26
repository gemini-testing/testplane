"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
class SetCollection {
    constructor(sets) {
        this._sets = sets;
    }
    static create(sets) {
        return new SetCollection(sets);
    }
    groupByFile() {
        const files = this._getFiles();
        const browsers = files.map((file) => this._getBrowsersForFile(file));
        return lodash_1.default.zipObject(files, browsers);
    }
    _getFiles() {
        return this._getFromSets((set) => set.getFiles());
    }
    _getBrowsersForFile(path) {
        return this._getFromSets((set) => set.getBrowsersForFile(path));
    }
    groupByBrowser() {
        const browsers = this._getBrowsers();
        const files = browsers.map((browser) => this._getFilesForBrowser(browser));
        return lodash_1.default.zipObject(browsers, files);
    }
    _getBrowsers() {
        return this._getFromSets((set) => set.getBrowsers());
    }
    _getFilesForBrowser(browser) {
        return this._getFromSets((set) => set.getFilesForBrowser(browser));
    }
    _getFromSets(cb) {
        return (0, lodash_1.default)(this._sets)
            .map(cb)
            .flatten()
            .uniq()
            .value();
    }
}
exports.default = SetCollection;
