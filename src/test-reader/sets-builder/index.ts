import _ from "lodash";
import path from "path";
import { SetCollection } from "./set-collection";
import { TestSet, TestSetData } from "./test-set";
import type * as globExtra from "../../bundle/glob-extra";
import type { SetsConfigParsed } from "../../config/types";

export type SetsBuilderOpts = {
    defaultPaths: string[];
};

const FILE_EXTENSIONS = [".js", ".mjs"];

export class SetsBuilder {
    #sets: Record<string, TestSet>;
    #filesToUse;

    static create(sets: Record<string, SetsConfigParsed>, opts: SetsBuilderOpts): SetsBuilder {
        return new SetsBuilder(sets, opts);
    }

    constructor(sets: Record<string, SetsConfigParsed>, opts: SetsBuilderOpts) {
        this.#sets = _.mapValues(sets, set => TestSet.create(set));
        this.#filesToUse = this.#hasFiles() ? [] : opts.defaultPaths;
    }

    useSets(setsToUse: string[]): SetsBuilder {
        this.#validateUnknownSets(setsToUse);

        if (!_.isEmpty(setsToUse)) {
            this.#sets = _.pick(this.#sets, setsToUse);
        }

        return this;
    }

    #validateUnknownSets(setsToUse: string[]): void {
        const setsNames = _.keys(this.#sets);
        const unknownSets = _.difference(setsToUse, setsNames);

        if (_.isEmpty(unknownSets)) {
            return;
        }

        let error = `No such sets: ${unknownSets.join(", ")}.`;

        if (!_.isEmpty(setsNames)) {
            error += ` Use one of the specified sets: ${setsNames.join(", ")}`;
        }

        throw new Error(error);
    }

    useFiles(files: string[]): SetsBuilder {
        if (!_.isEmpty(files)) {
            this.#filesToUse = files;
        }

        return this;
    }

    useBrowsers(browsers: string[]): SetsBuilder {
        _.forEach(this.#sets, set => set.useBrowsers(browsers));

        return this;
    }

    build(
        projectRoot: string,
        globOpts: { ignore?: string[] | string } = {},
        fileExtensions = FILE_EXTENSIONS,
    ): Promise<SetCollection> {
        const expandOpts = { formats: fileExtensions, root: projectRoot };

        if (globOpts.ignore) {
            globOpts.ignore = ([] as string[])
                .concat(globOpts.ignore)
                .map(ignorePattern => path.resolve(projectRoot, ignorePattern));
        }

        const resolvePathsPromise = this.#transformDirsToMasks().then(() => this.#resolvePaths(projectRoot));
        const globExtraPromise = import("../../bundle/glob-extra");

        return resolvePathsPromise
            .then(() => globExtraPromise)
            .then(globExtra => globExtra.expandPaths(this.#filesToUse, expandOpts, globOpts as { ignore: string[] }))
            .then(expandedFiles => {
                this.#validateFoundFiles(expandedFiles);
                this.#useFiles(expandedFiles);
            })
            .then(() => this.#expandFiles(expandOpts, globOpts as { ignore: string[] }))
            .then(() => SetCollection.create(this.#sets));
    }

    #transformDirsToMasks(): Promise<string[][]> {
        return Promise.all(this.#getSets().map(set => set.transformDirsToMasks()));
    }

    #getSets(): TestSet[] {
        return _.values(this.#sets);
    }

    #resolvePaths(projectRoot: string): void {
        _.forEach(this.#sets, set => set.resolveFiles(projectRoot));
    }

    #validateFoundFiles(foundFiles: string[]): void {
        if (!_.isEmpty(this.#filesToUse) && _.isEmpty(foundFiles)) {
            const paths = ([] as string[]).concat(this.#filesToUse).join(", ");
            throw new Error(`Cannot find files by specified paths: ${paths}`);
        }
    }

    #useFiles(filesToUse: string[]): void {
        _.forEach(this.#sets, set => set.useFiles(filesToUse));

        if (!this.#hasFiles()) {
            throw new Error("Cannot find files by masks in sets");
        }
    }

    #expandFiles(expandOpts: globExtra.ExpandOpts, globOpts: globExtra.GlobOpts): Promise<TestSetData[]> {
        return Promise.all(this.#getSets().map(set => set.expandFiles(expandOpts, globOpts)));
    }

    #hasFiles(): boolean {
        return _.some(this.#sets, set => !_.isEmpty(set.getFiles()));
    }
}
