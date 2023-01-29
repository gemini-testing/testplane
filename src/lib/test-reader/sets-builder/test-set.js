const globExtra = require("glob-extra");
const _ = require("lodash");
const mm = require("micromatch");
const path = require("path");
const Promise = require("bluebird");

const fs = Promise.promisifyAll(require("fs"));

module.exports = class TestSet {
    #set;

    static create(set) {
        return new TestSet(set);
    }

    constructor(set) {
        this.#set = _.clone(set);
    }

    expandFiles(expandOpts, globOpts = {}) {
        const { files, ignoreFiles = [] } = this.#set;
        globOpts = _.clone(globOpts);
        globOpts.ignore = []
            .concat(globOpts.ignore || [], ignoreFiles)
            .map((p) => path.resolve(expandOpts.root, p));

        return globExtra.expandPaths(files, expandOpts, globOpts)
            .then((expandedFiles) => this.#set = _.extend(this.#set, { files: expandedFiles }));
    }

    transformDirsToMasks() {
        return Promise.map(this.#set.files, (file) => {
            if (globExtra.isMask(file)) {
                return file;
            }

            return fs.statAsync(file)
                .then((stat) => stat.isDirectory() ? path.join(file, "**") : file)
                .catch(() => Promise.reject(new Error(`Cannot read such file or directory: '${file}'`)));
        })
            .then((files) => this.#set.files = files);
    }

    resolveFiles(projectRoot) {
        this.#set.files = this.#set.files.map((file) => path.resolve(projectRoot, file));
    }

    getFiles() {
        return this.#set.files;
    }

    getBrowsers() {
        return this.#set.browsers;
    }

    getFilesForBrowser(browser) {
        return _.includes(this.#set.browsers, browser) ? this.#set.files : [];
    }

    getBrowsersForFile(file) {
        return _.includes(this.#set.files, file) ? this.#set.browsers : [];
    }

    useFiles(files) {
        if (_.isEmpty(files)) {
            return;
        }

        this.#set.files = _.isEmpty(this.#set.files) ? files : mm(files, this.#set.files);
    }

    useBrowsers(browsers) {
        this.#set.browsers = _.isEmpty(browsers)
            ? this.#set.browsers
            : _.intersection(this.#set.browsers, browsers);
    }
};
