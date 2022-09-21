import _ from 'lodash';

import type TestSet from './test-set';

export default class SetCollection {
    private _sets: Record<string, TestSet>;

    static create(sets: Record<string, TestSet>): SetCollection {
        return new SetCollection(sets);
    }

    constructor(sets: Record<string, TestSet>) {
        this._sets = sets;
    }

    groupByFile(): Record<string, Array<string>> {
        const files = this._getFiles();
        const browsers = files.map((file) => this._getBrowsersForFile(file));

        return _.zipObject(files, browsers);
    }

    private _getFiles(): Array<string> {
        return this._getFromSets((set) => set.getFiles());
    }

    private _getBrowsersForFile(path: string): Array<string> {
        return this._getFromSets((set) => set.getBrowsersForFile(path));
    }

    groupByBrowser(): Record<string, Array<string>> {
        const browsers = this._getBrowsers();
        const files = browsers.map((browser) => this._getFilesForBrowser(browser));

        return _.zipObject(browsers, files);
    }

    private _getBrowsers(): Array<string> {
        return this._getFromSets((set) => set.getBrowsers());
    }

    private _getFilesForBrowser(browser: string): Array<string> {
        return this._getFromSets((set) => set.getFilesForBrowser(browser));
    }

    private _getFromSets(cb: (set: TestSet) => Array<string>): Array<string> {
        return _(this._sets)
            .map(cb)
            .flatten()
            .uniq()
            .value();
    }
}
