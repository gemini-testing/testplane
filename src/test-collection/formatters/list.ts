import path from "node:path";
import type { TestCollection, TestDisabled, FormatterListTest } from "..";

export const format = (testCollection: TestCollection): FormatterListTest[] => {
    const allTestsById = new Map<string, FormatterListTest>();

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
            pending: test.pending,
            skipReason: test.skipReason,
        });
    });

    return [...allTestsById.values()];
};
