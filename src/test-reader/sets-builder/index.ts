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

        const lines: string[] = [];
        lines.push(`What happened: Unknown test set(s) specified: "${unknownSets.join('", "')}".`);
        lines.push("\nPossible reasons:");
        lines.push("  - Set name is misspelled in the CLI argument or script");
        lines.push("  - Set was renamed or removed from the testplane config");
        lines.push("\nWhat you can do:");
        if (!_.isEmpty(setsNames)) {
            lines.push(`  - Use one of the configured sets: ${setsNames.join(", ")}`);
        }
        lines.push('  - Check the "sets" key in your testplane.config.js to see which sets are defined');
        throw new Error(lines.join("\n"));
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
            const lines: string[] = [];
            lines.push(`What happened: No test files were found at the specified path(s): ${paths}`);
            lines.push("\nPossible reasons:");
            lines.push("  - The path(s) are incorrect or contain typos");
            lines.push("  - The files were moved, renamed, or deleted");
            lines.push("  - The paths are relative and the working directory is not what you expect");
            lines.push("\nWhat you can do:");
            lines.push("  - Double-check the file paths passed as CLI arguments");
            lines.push("  - Run the command from the project root directory");
            lines.push("  - Use glob patterns (e.g. 'tests/**/*.test.js') to match multiple files");
            throw new Error(lines.join("\n"));
        }
    }

    #useFiles(filesToUse: string[]): void {
        _.forEach(this.#sets, set => set.useFiles(filesToUse));

        if (!this.#hasFiles()) {
            const lines: string[] = [];
            lines.push(
                "What happened: No test files were found matching the glob masks defined in the sets configuration.",
            );
            lines.push("\nPossible reasons:");
            lines.push("  - The 'files' globs in your testplane config sets don't match any existing files");
            lines.push("  - Test files have an extension not included in the file extensions list (.js, .mjs)");
            lines.push("  - All matched directories are empty");
            lines.push("\nWhat you can do:");
            lines.push("  - Review the 'sets' section in your testplane.config.js and verify the 'files' globs");
            lines.push("  - Check that test files exist in the directories specified by the globs");
            lines.push("  - Ensure test files use supported extensions (.js or .mjs)");
            throw new Error(lines.join("\n"));
        }
    }

    #expandFiles(expandOpts: globExtra.ExpandOpts, globOpts: globExtra.GlobOpts): Promise<TestSetData[]> {
        return Promise.all(this.#getSets().map(set => set.expandFiles(expandOpts, globOpts)));
    }

    #hasFiles(): boolean {
        return _.some(this.#sets, set => !_.isEmpty(set.getFiles()));
    }
}
