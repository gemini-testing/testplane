import path from "node:path";
import _ from "lodash";

import { format } from "../../../../../../src/cli/commands/list-tests/formatters/list";
import { Test, Suite } from "../../../../../../src/test-reader/test-object";
import { TestCollection } from "../../../../../../src/test-collection";

type TestOpts = {
    id: string;
    title: string;
    file: string;
    parent: Suite;
    disabled: boolean;
};

describe("cli/commands/list-tests/formatters/list", () => {
    const mkTest_ = (opts: Partial<TestOpts> = { title: "default-title" }): Test => {
        const paramNames = ["id", "title", "file"];

        const test = new Test(_.pick(opts, paramNames) as any);
        for (const [key, value] of _.entries(_.omit(opts, paramNames))) {
            _.set(test, key, value);
        }

        return test;
    };

    it("should return empty array if all tests are disabled", () => {
        const collection = TestCollection.create({
            bro1: [mkTest_({ disabled: true })],
            bro2: [mkTest_({ disabled: true })],
        });

        const result = format(collection);

        assert.deepEqual(result, []);
    });

    it("should return tests with correct fields", () => {
        const root1 = new Suite({ title: "root1" } as any);
        const root2 = new Suite({ title: "root2" } as any);

        const file1 = path.resolve(process.cwd(), "./folder/file1.ts");
        const file2 = path.resolve(process.cwd(), "./folder/file2.ts");

        const test1 = mkTest_({ id: "0", title: "test1", file: file1, parent: root1 });
        const test2 = mkTest_({ id: "1", title: "test2", file: file2, parent: root2 });

        const collection = TestCollection.create({
            bro1: [test1],
            bro2: [test1, test2],
        });

        const result = format(collection);

        assert.deepEqual(result, [
            {
                id: "0",
                titlePath: ["root1", "test1"],
                browserIds: ["bro1", "bro2"],
                file: "folder/file1.ts",
            },
            {
                id: "1",
                titlePath: ["root2", "test2"],
                browserIds: ["bro2"],
                file: "folder/file2.ts",
            },
        ]);
    });
});
