'use strict';

const _ = require('lodash');

module.exports = class TestFileCollection {
    static create(filenames) {
        return new TestFileCollection(filenames);
    }

    constructor(filenames) {
        this._files = filenames.map((name) => ({name, lastLoadedTestIndex: -1}));
    }

    isEmpty() {
        return !this._files.length;
    }

    getCurrentFile() {
        return _.first(this._files).name;
    }

    nextFile() {
        this._files.shift();
    }

    lastLoadedTestIndex(filename) {
        return this._findFile(filename).lastLoadedTestIndex;
    }

    registerTest(test) {
        ++this._findFile(test.file).lastLoadedTestIndex;
    }

    _findFile(name) {
        return _.find(this._files, {name});
    }
};
