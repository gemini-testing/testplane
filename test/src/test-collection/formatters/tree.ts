import path from "node:path";
import _ from "lodash";

import { TestCollection } from "../../../../src/test-collection";
import { format } from "../../../../src/test-collection/formatters/tree";
import { Test, Suite } from "../../../../src/test-reader/test-object";

type SuiteOpts = {
    id: string;
    title: string;
    file: string;
    parent: Suite;
    root: boolean;
    location: {
        line: number;
        column: number;
    };
    pending: boolean;
    skipReason: string;
};

type TestOpts = Omit<SuiteOpts, "root"> & {
    disabled: boolean;
};

describe("test-collection/formatters/tree", () => {
    const mkSuite_ = (opts: Partial<SuiteOpts> = { title: "default-suite-title" }): Suite => {
        const paramNames = ["id", "title", "file", "location"];

        const suite = new Suite(_.pick(opts, paramNames) as any);
        for (const [key, value] of _.entries(_.omit(opts, paramNames))) {
            _.set(suite, key, value);
        }

        return suite;
    };

    const mkTest_ = (opts: Partial<TestOpts> = { title: "default-test-title" }): Test => {
        const paramNames = ["id", "title", "file", "location"];

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

    describe("should return main test", () => {
        it("in one browser", () => {
            const rootSuite = mkSuite_({ id: "0", root: true });
            const testOpts: Partial<TestOpts> = {
                id: "1",
                title: "test",
                file: path.resolve(process.cwd(), "./folder/file.ts"),
                location: {
                    line: 1,
                    column: 1,
                },
                parent: rootSuite,
            };

            const collection = TestCollection.create({
                bro1: [mkTest_(testOpts)],
            });

            const result = format(collection);

            assert.deepEqual(result, [
                {
                    id: "1",
                    title: "test",
                    file: "folder/file.ts",
                    line: 1,
                    column: 1,
                    pending: false,
                    skipReason: "",
                    browserIds: ["bro1"],
                },
            ]);
        });

        it("in few browsers", () => {
            const rootSuite = mkSuite_({ id: "0", root: true });
            const testOpts: Partial<TestOpts> = {
                id: "1",
                title: "test",
                file: path.resolve(process.cwd(), "./folder/file.ts"),
                location: {
                    line: 1,
                    column: 1,
                },
                parent: rootSuite,
            };

            const collection = TestCollection.create({
                bro1: [mkTest_(testOpts)],
                bro2: [mkTest_(testOpts)],
            });

            const result = format(collection);

            assert.deepEqual(result, [
                {
                    id: "1",
                    title: "test",
                    file: "folder/file.ts",
                    line: 1,
                    column: 1,
                    pending: false,
                    skipReason: "",
                    browserIds: ["bro1", "bro2"],
                },
            ]);
        });

        it("in skipped state", () => {
            const rootSuite = mkSuite_({ id: "0", root: true });
            const testOpts: Partial<TestOpts> = {
                id: "1",
                title: "test",
                file: path.resolve(process.cwd(), "./folder/file.ts"),
                location: {
                    line: 1,
                    column: 1,
                },
                parent: rootSuite,
                pending: true,
                skipReason: "flaky",
            };

            const collection = TestCollection.create({
                bro1: [mkTest_(testOpts)],
            });

            const result = format(collection);

            assert.deepEqual(result, [
                {
                    id: "1",
                    title: "test",
                    file: "folder/file.ts",
                    line: 1,
                    column: 1,
                    pending: true,
                    skipReason: "flaky",
                    browserIds: ["bro1"],
                },
            ]);
        });
    });

    it("should return main tests with equal titles", () => {
        const rootSuite = mkSuite_({ id: "0", root: true });
        const commonTestOpts: Partial<TestOpts> = {
            id: "1",
            title: "test",
            location: {
                line: 1,
                column: 1,
            },
            parent: rootSuite,
        };
        const testOpts1: Partial<TestOpts> = {
            ...commonTestOpts,
            id: "1",
            file: path.resolve(process.cwd(), "./folder/file1.ts"),
        };
        const testOpts2: Partial<TestOpts> = {
            ...commonTestOpts,
            id: "2",
            file: path.resolve(process.cwd(), "./folder/file2.ts"),
        };

        const collection = TestCollection.create({
            bro1: [mkTest_(testOpts1)],
            bro2: [mkTest_(testOpts2)],
        });

        const result = format(collection);

        assert.deepEqual(result, [
            {
                id: "1",
                title: "test",
                file: "folder/file1.ts",
                line: 1,
                column: 1,
                pending: false,
                skipReason: "",
                browserIds: ["bro1"],
            },
            {
                id: "2",
                title: "test",
                file: "folder/file2.ts",
                line: 1,
                column: 1,
                pending: false,
                skipReason: "",
                browserIds: ["bro2"],
            },
        ]);
    });

    it("should return main suite with one test", () => {
        const rootSuite = mkSuite_({ id: "0", root: true });
        const suiteOpts: Partial<SuiteOpts> = {
            id: "1",
            title: "suite",
            file: path.resolve(process.cwd(), "./folder/file.ts"),
            location: {
                line: 1,
                column: 1,
            },
            parent: rootSuite,
        };
        const suite = mkSuite_(suiteOpts);

        const testOpts: Partial<TestOpts> = {
            id: "2",
            title: "test",
            file: path.resolve(process.cwd(), "./folder/file.ts"),
            location: {
                line: 2,
                column: 5,
            },
            parent: suite,
        };

        const collection = TestCollection.create({
            bro1: [mkTest_(testOpts)],
        });

        const result = format(collection);

        assert.deepEqual(result, [
            {
                id: "1",
                title: "suite",
                file: "folder/file.ts",
                line: 1,
                column: 1,
                pending: false,
                skipReason: "",
                suites: [],
                tests: [
                    {
                        id: "2",
                        title: "test",
                        line: 2,
                        column: 5,
                        pending: false,
                        skipReason: "",
                        browserIds: ["bro1"],
                    },
                ],
            },
        ]);
    });

    it("should return main suite with child suite", () => {
        const rootSuite = mkSuite_({ id: "0", root: true });
        const mainSuiteOpts: Partial<SuiteOpts> = {
            id: "1",
            title: "suite1",
            file: path.resolve(process.cwd(), "./folder/file.ts"),
            location: {
                line: 1,
                column: 1,
            },
            parent: rootSuite,
        };
        const mainSuite = mkSuite_(mainSuiteOpts);

        const childSuiteOpts: Partial<SuiteOpts> = {
            id: "2",
            title: "suite2",
            file: path.resolve(process.cwd(), "./folder/file.ts"),
            location: {
                line: 2,
                column: 5,
            },
            parent: mainSuite,
        };
        const childSuite = mkSuite_(childSuiteOpts);

        const testOpts: Partial<TestOpts> = {
            id: "3",
            title: "test",
            file: path.resolve(process.cwd(), "./folder/file.ts"),
            location: {
                line: 3,
                column: 9,
            },
            parent: childSuite,
        };

        const collection = TestCollection.create({
            bro1: [mkTest_(testOpts)],
        });

        const result = format(collection);

        assert.deepEqual(result, [
            {
                id: "1",
                title: "suite1",
                file: "folder/file.ts",
                line: 1,
                column: 1,
                pending: false,
                skipReason: "",
                suites: [
                    {
                        id: "2",
                        title: "suite2",
                        line: 2,
                        column: 5,
                        pending: false,
                        skipReason: "",
                        suites: [],
                        tests: [
                            {
                                id: "3",
                                title: "test",
                                line: 3,
                                column: 9,
                                pending: false,
                                skipReason: "",
                                browserIds: ["bro1"],
                            },
                        ],
                    },
                ],
                tests: [],
            },
        ]);
    });
});
