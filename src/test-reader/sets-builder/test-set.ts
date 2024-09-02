import * as globExtra from "glob-extra";
import _ from "lodash";
import mm from "micromatch";
import path from "path";
import fs from "fs/promises";
import { SetsConfigParsed } from "../../config/types";

export type TestSetData = {
    files: Array<string>;
    ignoreFiles?: Array<string>;
    browsers?: Array<string>;
};

export class TestSet {
    #set: TestSetData;

    static create(set: SetsConfigParsed): TestSet {
        return new TestSet(set);
    }

    constructor(set: SetsConfigParsed) {
        this.#set = _.clone(set);
    }

    async expandFiles(expandOpts: globExtra.ExpandOpts, globOpts: globExtra.GlobOpts = {}): Promise<TestSetData> {
        const { files, ignoreFiles = [] } = this.#set;
        globOpts = _.clone(globOpts);
        globOpts.ignore = ([] as string[])
            .concat(globOpts.ignore || [], ignoreFiles)
            .map(p => path.resolve(expandOpts.root, p));

        return globExtra
            .expandPaths(files, expandOpts, globOpts)
            .then(expandedFiles => (this.#set = _.extend(this.#set, { files: expandedFiles })));
    }

    async transformDirsToMasks(): Promise<string[]> {
        return Promise.all(
            this.#set.files.map(file => {
                if (globExtra.isMask(file)) {
                    return file;
                }

                return fs
                    .stat(file)
                    .then(stat => (stat.isDirectory() ? path.join(file, "**") : file))
                    .catch(() => Promise.reject(new Error(`Cannot read such file or directory: '${file}'`)));
            }),
        ).then(files => (this.#set.files = files));
    }

    resolveFiles(projectRoot: string): void {
        this.#set.files = this.#set.files.map(file => path.resolve(projectRoot, file));
    }

    getFiles(): string[] {
        return this.#set.files;
    }

    getBrowsers(): string[] {
        return this.#set.browsers!;
    }

    getFilesForBrowser(browser: string): string[] {
        return _.includes(this.#set.browsers, browser) ? this.#set.files : [];
    }

    getBrowsersForFile(file: string): string[] {
        return _.includes(this.#set.files, file) ? this.#set.browsers! : [];
    }

    useFiles(files: string[]): void {
        if (_.isEmpty(files)) {
            return;
        }

        this.#set.files = _.isEmpty(this.#set.files) ? files : mm(files, this.#set.files);
    }

    useBrowsers(browsers: string[]): void {
        this.#set.browsers = _.isEmpty(browsers) ? this.#set.browsers : _.intersection(this.#set.browsers, browsers);
    }
}
