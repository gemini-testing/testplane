import * as globExtra from "../../bundle/glob-extra";
import { SetsConfigParsed } from "../../config/types";
export type TestSetData = {
    files: Array<string>;
    ignoreFiles?: Array<string>;
    browsers?: Array<string>;
};
export declare class TestSet {
    #private;
    static create(set: SetsConfigParsed): TestSet;
    constructor(set: SetsConfigParsed);
    expandFiles(expandOpts: globExtra.ExpandOpts, globOpts?: globExtra.GlobOpts): Promise<TestSetData>;
    transformDirsToMasks(): Promise<string[]>;
    resolveFiles(projectRoot: string): void;
    getFiles(): string[];
    getBrowsers(): string[];
    getFilesForBrowser(browser: string): string[];
    getBrowsersForFile(file: string): string[];
    useFiles(files: string[]): void;
    useBrowsers(browsers: string[]): void;
}
