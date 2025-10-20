import { memoize } from "lodash";
import path from "node:path";
import fs from "fs-extra";
import { shallowSortObject } from "./utils";
import type { Test } from "../../../types";
import type { NormalizedDependencies } from "./types";

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
    private _directoryCreated = false;

    constructor(selectivityRootPath: string) {
        this._selectivityTestsPath = path.join(selectivityRootPath, "tests");
    }

    async saveFor(test: Test, browserDependencies: NormalizedDependencies): Promise<void> {
        if (!this._directoryCreated) {
            await fs.ensureDir(this._selectivityTestsPath);
            this._directoryCreated = true;
        }

        const testDepsPath = path.join(this._selectivityTestsPath, `${test.id}.json`);
        const testDepsContent = fs.existsSync(testDepsPath) ? await fs.readFile(testDepsPath, "utf8") : "";
        let testDeps: Record<string, { browser: NormalizedDependencies }> = {};

        try {
            if (testDepsContent) {
                testDeps = JSON.parse(testDepsContent);
            }
        } catch {} // eslint-disable-line no-empty

        if (areDepsSame(testDeps[test.browserId]?.browser, browserDependencies)) {
            return;
        }

        testDeps[test.browserId] = { browser: browserDependencies };

        shallowSortObject(testDeps);

        // Writing pretty json to avoid vcs merge conflicts
        await fs.writeFile(testDepsPath, JSON.stringify(testDeps, null, 2));
    }
}

export const getTestDependenciesWriter = memoize((selectivityRootPath: string): TestDependenciesWriter => {
    return new TestDependenciesWriter(selectivityRootPath);
});
