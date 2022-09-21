import Bluebird from 'bluebird';
import globExtra from 'glob-extra';
import _ from 'lodash';
import path from 'path';

import type {ExpandOpts, GlobOpts} from 'glob-extra';

import SetCollection from './set-collection';
import TestSet from './test-set';

import type {SetsConfig, SetConfig} from '../config/options';

const FILE_EXTENSIONS = ['.js'];

type SetsBuilderOpts = {
    defaultDir: string;
};

export default class SetsBuilder {
    private _sets: Record<string, TestSet>;
    private _defaultDir: string;
    private _filesToUse: Array<string>;

    static create(sets: SetsConfig, opts: SetsBuilderOpts): SetsBuilder {
        return new SetsBuilder(sets, opts);
    }

    constructor(sets: SetsConfig, opts: SetsBuilderOpts) {
        this._sets = _.mapValues(sets, (set) => TestSet.create(set));
        this._defaultDir = opts.defaultDir;

        this._filesToUse = this._hasFiles() ? [] : [this._defaultDir];
    }

    useSets(setsToUse: Array<string>): this {
        this._validateUnknownSets(setsToUse);

        if (!_.isEmpty(setsToUse)) {
            this._sets = _.pick(this._sets, setsToUse);
        }

        return this;
    }

    private _validateUnknownSets(setsToUse: Array<string>): void {
        const setsNames = _.keys(this._sets);
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

    useFiles(files: Array<string>): this {
        if (!_.isEmpty(files)) {
            this._filesToUse = files;
        }

        return this;
    }

    useBrowsers(browsers: Array<string>): this {
        _.forEach(this._sets, (set) => set.useBrowsers(browsers));

        return this;
    }

    async build(projectRoot: string, globOpts: GlobOpts = {}, fileExtensions: Array<string> = FILE_EXTENSIONS): Promise<SetCollection> {
        const expandOpts = {formats: fileExtensions, root: projectRoot};

        if (globOpts.ignore) {
            globOpts.ignore = ([] as Array<string>).concat(globOpts.ignore)
                .map((ignorePattern) => path.resolve(projectRoot, ignorePattern));
        }

        await this._transformDirsToMasks();

        this._resolvePaths(projectRoot);
        const expandedFiles = await globExtra.expandPaths(this._filesToUse, expandOpts, globOpts);

        this._validateFoundFiles(expandedFiles);
        this._useFiles(expandedFiles);

        await this._expandFiles(expandOpts, globOpts);

        return SetCollection.create(this._sets);
    }

    private _transformDirsToMasks(): Promise<Array<Array<string>>> {
        return Bluebird.map(this._getSets(), (set) => set.transformDirsToMasks());
    }

    private _getSets(): Array<TestSet> {
        return _.values(this._sets);
    }

    private _resolvePaths(projectRoot: string): void {
        _.forEach(this._sets, (set) => set.resolveFiles(projectRoot));
    }

    private _validateFoundFiles(foundFiles: Array<string>): void {
        if (!_.isEmpty(this._filesToUse) && _.isEmpty(foundFiles)) {
            const paths = ([] as Array<string>).concat(this._filesToUse).join(', ');

            throw new Error(`Cannot find files by specified paths: ${paths}`);
        }
    }

    private _useFiles(filesToUse: Array<string>): void {
        _.forEach(this._sets, (set) => set.useFiles(filesToUse));

        if (!this._hasFiles()) {
            throw new Error('Cannot find files by masks in sets');
        }
    }

    private _expandFiles(expandOpts: ExpandOpts, globOpts: GlobOpts): Promise<Array<SetConfig>> {
        return Bluebird.map(this._getSets(), (set) => set.expandFiles(expandOpts, globOpts));
    }

    private _hasFiles(): boolean {
        return _.some(this._sets, (set) => !_.isEmpty(set.getFiles()));
    }
}
