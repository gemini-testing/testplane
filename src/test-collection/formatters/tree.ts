import path from "node:path";

import type {
    TestCollection,
    TestDisabled,
    FormatterTreeMainRunnable,
    FormatterTreeTest,
    FormatterTreeSuite,
} from "..";
import type { Suite, Test } from "../../types";

export const format = (testCollection: TestCollection): FormatterTreeMainRunnable[] => {
    const allSuitesById = new Map<string, FormatterTreeSuite>();
    const allTestsById = new Map<string, FormatterTreeTest>();

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

function collectSuites(
    suite: Suite,
    child: FormatterTreeTest | FormatterTreeSuite,
    allSuitesById: Map<string, FormatterTreeSuite>,
): void {
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

function isTreeTest(runnable: unknown): runnable is FormatterTreeTest {
    return Boolean((runnable as FormatterTreeTest).browserIds);
}

function createTreeTest(test: Test, browserId: string): FormatterTreeTest {
    return {
        id: test.id,
        title: test.title,
        pending: test.pending,
        skipReason: test.skipReason,
        ...test.location!,
        browserIds: [browserId],
        ...getMainRunanbleFields(test),
    };
}

function createTreeSuite(suite: Suite): FormatterTreeSuite {
    return {
        id: suite.id,
        title: suite.title,
        pending: suite.pending,
        skipReason: suite.skipReason,
        ...suite.location!,
        ...getMainRunanbleFields(suite),
        suites: [],
        tests: [],
    };
}

function addChild(treeSuite: FormatterTreeSuite, child: FormatterTreeTest | FormatterTreeSuite): void {
    const fieldName = isTreeTest(child) ? "tests" : "suites";
    const foundRunnable = treeSuite[fieldName].find(test => test.id === child.id);

    if (!foundRunnable) {
        isTreeTest(child) ? addTest(treeSuite, child) : addSuite(treeSuite, child);
    }
}

function addTest(treeSuite: FormatterTreeSuite, child: FormatterTreeTest): void {
    treeSuite.tests.push(child);
}

function addSuite(treeSuite: FormatterTreeSuite, child: FormatterTreeSuite): void {
    treeSuite.suites.push(child);
}

function getMainRunanbleFields(runanble: Suite | Test): Partial<Pick<FormatterTreeMainRunnable, "file">> {
    const isMain = runanble.parent && runanble.parent.root;

    return {
        // "file" field must exists only in topmost runnables
        ...(isMain ? { file: path.relative(process.cwd(), runanble.file) } : {}),
    };
}

function getTreeRunnables(
    allSuitesById: Map<string, FormatterTreeSuite>,
    allTestsById: Map<string, FormatterTreeTest>,
): FormatterTreeMainRunnable[] {
    return [...allSuitesById.values(), ...allTestsById.values()].filter(
        suite => (suite as FormatterTreeMainRunnable).file,
    ) as FormatterTreeMainRunnable[];
}
