import path from "node:path";

import type { TestCollection, TestDisabled } from "../../../../test-collection";
import type { Suite, Test } from "../../../../types";

type TreeSuite = {
    id: string;
    title: string;
    line: number;
    column: number;
    suites: TreeSuite[];
    // eslint-disable-next-line no-use-before-define
    tests: TreeTest[];
};

type TreeTest = Omit<TreeSuite, "suites" | "tests"> & {
    browserIds: string[];
};

type MainTreeRunnable = (TreeSuite | TreeTest) & {
    file: string;
};

export const format = (testCollection: TestCollection): MainTreeRunnable[] => {
    const allSuitesById = new Map<string, TreeSuite>();
    const allTestsById = new Map<string, TreeTest>();

    testCollection.eachTest((test, browserId) => {
        if ((test as TestDisabled).disabled) {
            return;
        }

        if (allTestsById.has(test.id)) {
            const treeTest = allTestsById.get(test.id)!;

            if (!treeTest.browserIds.includes(browserId)) {
                treeTest.browserIds.push(browserId);
            }

            return;
        }

        const treeTest = createTreeTest(test, browserId);
        allTestsById.set(treeTest.id, treeTest);

        collectSuites(test.parent!, treeTest, allSuitesById);
    });

    return getTreeRunnables(allSuitesById, allTestsById);
};

function collectSuites(suite: Suite, child: TreeTest | TreeSuite, allSuitesById: Map<string, TreeSuite>): void {
    if (allSuitesById.has(suite.id)) {
        const treeSuite = allSuitesById.get(suite.id)!;
        addChild(treeSuite, child);

        return;
    }

    if (!suite.parent) {
        return;
    }

    const treeSuite = createTreeSuite(suite);
    addChild(treeSuite, child);

    allSuitesById.set(treeSuite.id, treeSuite);

    collectSuites(suite.parent, treeSuite, allSuitesById);
}

function isTreeTest(runnable: unknown): runnable is TreeTest {
    return Boolean((runnable as TreeTest).browserIds);
}

function createTreeTest(test: Test, browserId: string): TreeTest {
    return {
        id: test.id,
        title: test.title,
        ...test.location!,
        browserIds: [browserId],
        ...getMainRunanbleFields(test),
    };
}

function createTreeSuite(suite: Suite): TreeSuite {
    return {
        id: suite.id,
        title: suite.title,
        ...suite.location!,
        ...getMainRunanbleFields(suite),
        suites: [],
        tests: [],
    };
}

function addChild(treeSuite: TreeSuite, child: TreeTest | TreeSuite): void {
    const fieldName = isTreeTest(child) ? "tests" : "suites";
    const foundRunnable = treeSuite[fieldName].find(test => test.id === child.id);

    if (!foundRunnable) {
        isTreeTest(child) ? addTest(treeSuite, child) : addSuite(treeSuite, child);
    }
}

function addTest(treeSuite: TreeSuite, child: TreeTest): void {
    treeSuite.tests.push(child);
}

function addSuite(treeSuite: TreeSuite, child: TreeSuite): void {
    treeSuite.suites.push(child);
}

function getMainRunanbleFields(runanble: Suite | Test): Partial<Pick<MainTreeRunnable, "file">> {
    const isMain = runanble.parent && runanble.parent.root;

    return {
        ...(isMain ? { file: path.relative(process.cwd(), runanble.file) } : {}),
    };
}

function getTreeRunnables(
    allSuitesById: Map<string, TreeSuite>,
    allTestsById: Map<string, TreeTest>,
): MainTreeRunnable[] {
    return [...allSuitesById.values(), ...allTestsById.values()].filter(
        suite => (suite as MainTreeRunnable).file,
    ) as MainTreeRunnable[];
}
