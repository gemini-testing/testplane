const path = require('path');
const globExtra = require('glob-extra');
const _ = require('lodash');
const Promise = require('bluebird');

const SetCollection = require('./set-collection');
const TestSet = require('./test-set');

const FILE_EXTENSIONS = ['.js', '.mjs'];

module.exports = class SetsBuilder {
    #sets;
    #filesToUse;

    static create(sets, opts) {
        return new SetsBuilder(sets, opts);
    }

    constructor(sets, opts) {
        this.#sets = _.mapValues(sets, (set) => TestSet.create(set));
        this.#filesToUse = this.#hasFiles() ? [] : [opts.defaultDir];
    }

    useSets(setsToUse) {
        this.#validateUnknownSets(setsToUse);

        if (!_.isEmpty(setsToUse)) {
            this.#sets = _.pick(this.#sets, setsToUse);
        }

        return this;
    }

    #validateUnknownSets(setsToUse) {
        const setsNames = _.keys(this.#sets);
        const unknownSets = _.difference(setsToUse, setsNames);

        if (_.isEmpty(unknownSets)) {
            return;
        }

        let error = `No such sets: ${unknownSets.join(', ')}.`;

        if (!_.isEmpty(setsNames)) {
            error += ` Use one of the specified sets: ${setsNames.join(', ')}`;
        }

        throw new Error(error);
    }

    useFiles(files) {
        if (!_.isEmpty(files)) {
            this.#filesToUse = files;
        }

        return this;
    }

    useBrowsers(browsers) {
        _.forEach(this.#sets, (set) => set.useBrowsers(browsers));

        return this;
    }

    build(projectRoot, globOpts = {}, fileExtensions = FILE_EXTENSIONS) {
        const expandOpts = {formats: fileExtensions, root: projectRoot};

        if (globOpts.ignore) {
            globOpts.ignore = [].concat(globOpts.ignore)
                .map((ignorePattern) => path.resolve(projectRoot, ignorePattern));
        }

        return this.#transformDirsToMasks()
            .then(() => this.#resolvePaths(projectRoot))
            .then(() => globExtra.expandPaths(this.#filesToUse, expandOpts, globOpts))
            .then((expandedFiles) => {
                this.#validateFoundFiles(expandedFiles);
                this.#useFiles(expandedFiles);
            })
            .then(() => this.#expandFiles(expandOpts, globOpts))
            .then(() => SetCollection.create(this.#sets));
    }

    #transformDirsToMasks() {
        return Promise.map(this.#getSets(), (set) => set.transformDirsToMasks());
    }

    #getSets() {
        return _.values(this.#sets);
    }

    #resolvePaths(projectRoot) {
        _.forEach(this.#sets, (set) => set.resolveFiles(projectRoot));
    }

    #validateFoundFiles(foundFiles) {
        if (!_.isEmpty(this.#filesToUse) && _.isEmpty(foundFiles)) {
            const paths = [].concat(this.#filesToUse).join(', ');
            throw new Error(`Cannot find files by specified paths: ${paths}`);
        }
    }

    #useFiles(filesToUse) {
        _.forEach(this.#sets, (set) => set.useFiles(filesToUse));

        if (!this.#hasFiles()) {
            throw new Error('Cannot find files by masks in sets');
        }
    }

    #expandFiles(expandOpts, globOpts) {
        return Promise.map(this.#getSets(), (set) => set.expandFiles(expandOpts, globOpts));
    }

    #hasFiles() {
        return _.some(this.#sets, (set) => !_.isEmpty(set.getFiles()));
    }
};
