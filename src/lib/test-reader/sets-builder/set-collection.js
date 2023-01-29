const _ = require("lodash");

module.exports = class SetCollection {
    #sets;

    static create(sets) {
        return new SetCollection(sets);
    }

    constructor(sets) {
        this.#sets = sets;
    }

    groupByFile() {
        const files = this.#getFiles();
        const browsers = files.map((file) => this.#getBrowsersForFile(file));

        return _.zipObject(files, browsers);
    }

    #getFiles() {
        return this.#getFromSets((set) => set.getFiles());
    }

    #getBrowsersForFile(path) {
        return this.#getFromSets((set) => set.getBrowsersForFile(path));
    }

    groupByBrowser() {
        const browsers = this.#getBrowsers();
        const files = browsers.map((browser) => this.#getFilesForBrowser(browser));

        return _.zipObject(browsers, files);
    }

    #getBrowsers() {
        return this.#getFromSets((set) => set.getBrowsers());
    }

    #getFilesForBrowser(browser) {
        return this.#getFromSets((set) => set.getFilesForBrowser(browser));
    }

    #getFromSets(cb) {
        return _(this.#sets)
            .map(cb)
            .flatten()
            .uniq()
            .value();
    }
};
