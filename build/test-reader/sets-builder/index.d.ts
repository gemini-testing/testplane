export = SetsBuilder;
declare class SetsBuilder {
    static create(sets: any, opts: any): import(".");
    constructor(sets: any, opts: any);
    useSets(setsToUse: any): import(".");
    useFiles(files: any): import(".");
    useBrowsers(browsers: any): import(".");
    build(projectRoot: any, globOpts?: {}, fileExtensions?: string[]): any;
    #private;
}
