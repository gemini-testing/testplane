import { memoize } from "lodash";
import lockfile from "proper-lockfile";
import fs from "fs-extra";
import { getSelectivityTestsPath, getTestDependenciesPath, readTestDependencies, shallowSortObject } from "./utils";
import type { Test } from "../../../types";
import type { NormalizedDependencies, SelectivityCompressionType } from "./types";
import { writeJsonWithCompression } from "./json-utils";

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
        this._selectivityTestsPath = getSelectivityTestsPath(selectivityRootPath);
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

        const testDepsPath = getTestDependenciesPath(this._selectivityTestsPath, test);

        const releaseLock = await lockfile.lock(testDepsPath, {
            stale: 5000,
            update: 1000,
            retries: { minTimeout: 100, maxTimeout: 1000, retries: 15 },
            realpath: false,
        });

        try {
            const testDeps = await readTestDependencies(this._selectivityTestsPath, test, this._compression);

            if (
                areDepsSame(testDeps[test.browserId]?.browser, browserDeps) &&
                areDepsSame(testDeps[test.browserId]?.testplane, testplaneDeps)
            ) {
                return;
            }

            testDeps[test.browserId] = { browser: browserDeps, testplane: testplaneDeps };

            shallowSortObject(testDeps);

            await writeJsonWithCompression(testDepsPath, testDeps, this._compression);
        } finally {
            await releaseLock();
        }
    }
}

export const getTestDependenciesWriter = memoize(
    (selectivityRootPath: string, compression: SelectivityCompressionType): TestDependenciesWriter => {
        return new TestDependenciesWriter(selectivityRootPath, compression);
    },
    (selectivityRootPath, compression) => `${selectivityRootPath}#${compression}`,
);
