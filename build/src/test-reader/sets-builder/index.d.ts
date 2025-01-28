import { SetCollection } from "./set-collection";
import { SetsConfigParsed } from "../../config/types";
export type SetsBuilderOpts = {
    defaultPaths: string[];
};
export declare class SetsBuilder {
    #private;
    static create(sets: Record<string, SetsConfigParsed>, opts: SetsBuilderOpts): SetsBuilder;
    constructor(sets: Record<string, SetsConfigParsed>, opts: SetsBuilderOpts);
    useSets(setsToUse: string[]): SetsBuilder;
    useFiles(files: string[]): SetsBuilder;
    useBrowsers(browsers: string[]): SetsBuilder;
    build(projectRoot: string, globOpts?: {
        ignore?: string[] | string;
    }, fileExtensions?: string[]): Promise<SetCollection>;
}
