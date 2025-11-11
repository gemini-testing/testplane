import { memoize } from "lodash";
import path from "node:path";
import { mergeSourceDependencies, readTestDependencies } from "./utils";
import type { Test } from "../../../types";
import type { NormalizedDependencies, SelectivityCompressionType } from "./types";

export class TestDependenciesReader {
    private readonly _selectivityTestsPath: string;
    private readonly _compression: SelectivityCompressionType;

    constructor(selectivityRootPath: string, compression: SelectivityCompressionType) {
        this._selectivityTestsPath = path.join(selectivityRootPath, "tests");
        this._compression = compression;
    }

    async getFor(test: Test): Promise<NormalizedDependencies> {
        const testDeps = await readTestDependencies(this._selectivityTestsPath, test, this._compression);
        let result: NormalizedDependencies = { css: [], js: [], modules: [] };

        for (const browserId of Object.keys(testDeps)) {
            const depTypes = Object.keys(testDeps[browserId]);

            if (!depTypes.length) {
                continue;
            } else if (depTypes.length === 1) {
                result = mergeSourceDependencies(result, testDeps[browserId][depTypes[0]]);
            } else {
                let browserDeps: NormalizedDependencies = testDeps[browserId][depTypes[0]];

                for (let i = 1; i < depTypes.length; i++) {
                    browserDeps = mergeSourceDependencies(browserDeps, testDeps[browserId][depTypes[i]]);
                }

                result = mergeSourceDependencies(result, browserDeps);
            }
        }

        return result;
    }
}

export const getTestDependenciesReader = memoize(
    (selectivityRootPath: string, compression: SelectivityCompressionType): TestDependenciesReader => {
        return new TestDependenciesReader(selectivityRootPath, compression);
    },
    (selectivityRootPath, compression) => `${selectivityRootPath}#${compression}`,
);
