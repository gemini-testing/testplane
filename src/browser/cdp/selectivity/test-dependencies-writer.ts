import { memoize } from "lodash";
import path from "node:path";
import fs from "fs-extra";
import { shallowSortObject } from "./utils";
import type { Test } from "../../../types";
import type { NormalizedDependencies, SelectivityCompressionType } from "./types";
import { readJsonWithCompression, writeJsonWithCompression } from "./json-utils";

const areDepsSame = (browserDepsA?: NormalizedDependencies, browserDepsB?: NormalizedDependencies): boolean => {
    const props: Array<keyof NormalizedDependencies> = ["js", "css", "modules"] as const;

    if (!browserDepsA || !browserDepsB) {
        return false;
    }

    for (const prop of props) {
        if (!browserDepsA[prop] || !browserDepsB[prop] || browserDepsA[prop].length !== browserDepsB[prop].length) {
            return false;
        }
    }

    // Rely on the fact both are sorted arrays
    for (const prop of props) {
        for (let i = 0; i < browserDepsA[prop].length; i++) {
            if (browserDepsA[prop][i] !== browserDepsB[prop][i]) {
                return false;
            }
        }
    }

    return true;
};

export class TestDependenciesWriter {
    private readonly _selectivityTestsPath: string;
    private readonly _compression: SelectivityCompressionType;
    private _directoryCreated = false;

    constructor(selectivityRootPath: string, compression: SelectivityCompressionType) {
        this._selectivityTestsPath = path.join(selectivityRootPath, "tests");
        this._compression = compression;
    }

    async saveFor(
        test: Test,
        browserDeps: NormalizedDependencies,
        testplaneDeps: NormalizedDependencies,
    ): Promise<void> {
        if (!this._directoryCreated) {
            await fs.ensureDir(this._selectivityTestsPath);
            this._directoryCreated = true;
        }

        const testDepsPath = path.join(this._selectivityTestsPath, `${test.id}.json`);
        const testDeps: Record<string, { browser: NormalizedDependencies; testplane: NormalizedDependencies }> =
            await readJsonWithCompression(testDepsPath, this._compression, { defaultValue: {} }).catch(() => ({}));

        if (
            areDepsSame(testDeps[test.browserId]?.browser, browserDeps) &&
            areDepsSame(testDeps[test.browserId]?.testplane, testplaneDeps)
        ) {
            return;
        }

        testDeps[test.browserId] = { browser: browserDeps, testplane: testplaneDeps };

        shallowSortObject(testDeps);

        await writeJsonWithCompression(testDepsPath, testDeps, this._compression);
    }
}

export const getTestDependenciesWriter = memoize(
    (selectivityRootPath: string, compression: SelectivityCompressionType): TestDependenciesWriter => {
        return new TestDependenciesWriter(selectivityRootPath, compression);
    },
);
