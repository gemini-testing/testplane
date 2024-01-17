export = SetsBuilder;
declare class SetsBuilder {
    static create(sets: any, opts: any): import(".");
    constructor(sets: any, opts: any);
    useSets(setsToUse: any): this;
    useFiles(files: any): this;
    useBrowsers(browsers: any): this;
    build(projectRoot: any, globOpts?: {}, fileExtensions?: string[]): Promise<SetCollection>;
    #private;
}
import SetCollection = require("./set-collection");
import Promise = require("bluebird");
