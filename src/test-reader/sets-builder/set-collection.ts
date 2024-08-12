import _ from "lodash";
import TestSet from "./test-set";

class SetCollection {
    #sets: Record<string, TestSet>;

    static create(sets: Record<string, TestSet>): SetCollection {
        return new SetCollection(sets);
    }

    constructor(sets: Record<string, TestSet>) {
        this.#sets = sets;
    }

    groupByFile(): Record<string, unknown> {
        const files = this.getAllFiles();
        const browsers = files.map(file => this.#getBrowsersForFile(file));

        return _.zipObject(files, browsers);
    }

    getAllFiles(): string[] {
        return _.uniq(this.#getFromSets(set => set.getFiles()));
    }

    #getBrowsersForFile(path: string): string[] {
        return this.#getFromSets(set => set.getBrowsersForFile(path));
    }

    groupByBrowser(): Record<string, string[]> {
        const browsers = this.#getBrowsers();
        const files = browsers.map(browser => this.#getFilesForBrowser(browser));

        return _.zipObject(browsers, files);
    }

    #getBrowsers(): string[] {
        return this.#getFromSets(set => set.getBrowsers());
    }

    #getFilesForBrowser(browser: string): string[] {
        return this.#getFromSets(set => set.getFilesForBrowser(browser));
    }

    #getFromSets<T>(cb: (data: TestSet) => T): T {
        return _(this.#sets).map(cb).flatten().uniq().value() as T;
    }
}

export default SetCollection;
