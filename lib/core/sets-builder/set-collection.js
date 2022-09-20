'use strict';

const _ = require('lodash');

module.exports = class SetCollection {
    static create(sets) {
        return new SetCollection(sets);
    }

    constructor(sets) {
        this._sets = sets;
    }

    groupByFile() {
        const files = this._getFiles();
        const browsers = files.map((file) => this._getBrowsersForFile(file));

        return _.zipObject(files, browsers);
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

        return _.zipObject(browsers, files);
    }

    _getBrowsers() {
        return this._getFromSets((set) => set.getBrowsers());
    }

    _getFilesForBrowser(browser) {
        return this._getFromSets((set) => set.getFilesForBrowser(browser));
    }

    _getFromSets(cb) {
        return _(this._sets)
            .map(cb)
            .flatten()
            .uniq()
            .value();
    }
};
