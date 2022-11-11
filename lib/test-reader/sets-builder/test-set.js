'use strict';

const globExtra = require('glob-extra');
const _ = require('lodash');
const mm = require('micromatch');
const path = require('path');
const Promise = require('bluebird');

const fs = Promise.promisifyAll(require('fs'));

module.exports = class TestSet {
    static create(set) {
        return new TestSet(set);
    }

    constructor(set) {
        this._set = _.clone(set);
    }

    expandFiles(expandOpts, globOpts = {}) {
        const {files, ignoreFiles = []} = this._set;
        globOpts = _.clone(globOpts);
        globOpts.ignore = []
            .concat(globOpts.ignore || [], ignoreFiles)
            .map((p) => path.resolve(expandOpts.root, p));

        return globExtra.expandPaths(files, expandOpts, globOpts)
            .then((expandedFiles) => this._set = _.extend(this._set, {files: expandedFiles}));
    }

    transformDirsToMasks() {
        return Promise.map(this._set.files, (file) => {
            if (globExtra.isMask(file)) {
                return file;
            }

            return fs.statAsync(file)
                .then((stat) => stat.isDirectory() ? path.join(file, '**') : file)
                .catch(() => Promise.reject(new Error(`Cannot read such file or directory: '${file}'`)));
        })
            .then((files) => this._set.files = files);
    }

    resolveFiles(projectRoot) {
        this._set.files = this._set.files.map((file) => path.resolve(projectRoot, file));
    }

    getFiles() {
        return this._set.files;
    }

    getBrowsers() {
        return this._set.browsers;
    }

    getFilesForBrowser(browser) {
        return _.includes(this._set.browsers, browser) ? this._set.files : [];
    }

    getBrowsersForFile(file) {
        return _.includes(this._set.files, file) ? this._set.browsers : [];
    }

    useFiles(files) {
        if (_.isEmpty(files)) {
            return;
        }

        this._set.files = _.isEmpty(this._set.files) ? files : mm(files, this._set.files);
    }

    useBrowsers(browsers) {
        this._set.browsers = _.isEmpty(browsers)
            ? this._set.browsers
            : _.intersection(this._set.browsers, browsers);
    }
};
