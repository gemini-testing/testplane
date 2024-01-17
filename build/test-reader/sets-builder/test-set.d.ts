export = TestSet;
declare class TestSet {
    static create(set: any): import("./test-set");
    constructor(set: any);
    expandFiles(expandOpts: any, globOpts?: {}): Promise<any>;
    transformDirsToMasks(): any;
    resolveFiles(projectRoot: any): void;
    getFiles(): any;
    getBrowsers(): any;
    getFilesForBrowser(browser: any): any;
    getBrowsersForFile(file: any): any;
    useFiles(files: any): void;
    useBrowsers(browsers: any): void;
    #private;
}
