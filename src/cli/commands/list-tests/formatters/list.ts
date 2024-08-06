import path from "node:path";
import type { TestCollection, TestDisabled } from "../../../../test-collection";

type TestInfo = {
    id: string;
    titlePath: string[];
    file: string;
    browserIds: string[];
};

export const format = (testCollection: TestCollection): TestInfo[] => {
    const allTestsById = new Map<string, TestInfo>();

    testCollection.eachTest((test, browserId) => {
        if ((test as TestDisabled).disabled) {
            return;
        }

        if (allTestsById.has(test.id)) {
            const foundTest = allTestsById.get(test.id)!;

            if (!foundTest.browserIds.includes(browserId)) {
                foundTest.browserIds.push(browserId);
            }

            return;
        }

        allTestsById.set(test.id, {
            id: test.id,
            titlePath: test.titlePath(),
            browserIds: [browserId],
            file: path.relative(process.cwd(), test.file as string),
        });
    });

    return [...allTestsById.values()];
};
