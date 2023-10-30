export = SetsBuilder;
declare class SetsBuilder {
    static create(sets: any, opts: any): import(".");
    constructor(sets: any, opts: any);
    useSets(setsToUse: any): import(".");
    useFiles(files: any): import(".");
    useBrowsers(browsers: any): import(".");
    build(projectRoot: any, globOpts?: {}, fileExtensions?: string[]): Promise<SetCollection>;
    #private;
}
import SetCollection = require("./set-collection");
import Promise = require("bluebird");
