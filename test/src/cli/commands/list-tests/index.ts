import path from "node:path";
import { Command } from "@gemini-testing/commander";
import fs from "fs-extra";
import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

import { Formatters } from "../../../../../src/test-collection";
import logger from "../../../../../src/utils/logger";
import { Testplane } from "../../../../../src/testplane";
import * as testplaneCli from "../../../../../src/cli";
import { TestCollection } from "../../../../../src/test-collection";

describe("cli/commands/list-tests", () => {
    const sandbox = sinon.createSandbox();

    const listTests_ = async (argv: string = "", cli: { run: VoidFunction } = testplaneCli): Promise<void> => {
        process.argv = ["foo/bar/node", "foo/bar/script", "list-tests", ...argv.split(" ")].filter(Boolean);
        cli.run();

        await (Command.prototype.action as SinonStub).lastCall.returnValue;
    };

    beforeEach(() => {
        sandbox.stub(Testplane, "create").returns(Object.create(Testplane.prototype));
        sandbox.stub(Testplane.prototype, "readTests").resolves(TestCollection.create({}));

        sandbox.stub(fs, "ensureDir").resolves();
        sandbox.stub(fs, "writeJson").resolves();

        sandbox.stub(logger, "error");
        sandbox.stub(console, "info");
        sandbox.stub(process, "exit");

        sandbox.spy(Command.prototype, "action");
    });

    afterEach(() => sandbox.restore());

    it("should validate passed formatter", async () => {
        const validateFormatterStub = sandbox.stub();
        const cli = proxyquire("../../../../../src/cli", {
            [path.resolve(process.cwd(), "src/cli/commands/list-tests")]: proxyquire(
                "../../../../../src/cli/commands/list-tests",
                {
                    "../../../test-collection": {
                        validateFormatter: validateFormatterStub,
                    },
                },
            ),
        });

        await listTests_("--formatter foo", cli);

        assert.calledOnceWith(validateFormatterStub, "foo");
    });

    it("should exit with code 0", async () => {
        await listTests_();

        assert.calledWith(process.exit as unknown as SinonStub, 0);
    });

    it("should exit with code 1 if read tests failed", async () => {
        (Testplane.prototype.readTests as SinonStub).rejects(new Error("o.O"));

        await listTests_();

        assert.calledWith(process.exit as unknown as SinonStub, 1);
    });

    describe("read tests", () => {
        it("should use paths from cli", async () => {
            await listTests_("first.testplane.js second.testplane.js");

            assert.calledWith(Testplane.prototype.readTests as SinonStub, [
                "first.testplane.js",
                "second.testplane.js",
            ]);
        });

        it("should use browsers from cli", async () => {
            await listTests_("--browser first --browser second");

            assert.calledWithMatch(Testplane.prototype.readTests as SinonStub, sinon.match.any, {
                browsers: ["first", "second"],
            });
        });

        it("should use sets from cli", async () => {
            await listTests_("--set first --set second");

            assert.calledWithMatch(Testplane.prototype.readTests as SinonStub, sinon.match.any, {
                sets: ["first", "second"],
            });
        });

        it("should use grep from cli", async () => {
            await listTests_("--grep some");

            assert.calledWithMatch(Testplane.prototype.readTests as SinonStub, sinon.match.any, {
                grep: sinon.match.instanceOf(RegExp),
            });
        });

        it("should use ignore paths from cli", async () => {
            await listTests_("--ignore first --ignore second");

            assert.calledWithMatch(Testplane.prototype.readTests as SinonStub, sinon.match.any, {
                ignore: ["first", "second"],
            });
        });

        describe("silent", () => {
            it("should be disabled by default", async () => {
                await listTests_();

                assert.calledWithMatch(Testplane.prototype.readTests as SinonStub, sinon.match.any, { silent: false });
            });

            it("should use from cli", async () => {
                await listTests_("--silent");

                assert.calledWithMatch(Testplane.prototype.readTests as SinonStub, sinon.match.any, { silent: true });
            });
        });

        describe("runnableOpts", () => {
            it("should not save runnale locations by default", async () => {
                await listTests_();

                assert.calledWithMatch(Testplane.prototype.readTests as SinonStub, sinon.match.any, {
                    runnableOpts: {
                        saveLocations: false,
                    },
                });
            });

            it(`should save runnale locations if "${Formatters.TREE}" formatter is used`, async () => {
                await listTests_(`--formatter ${Formatters.TREE}`);

                assert.calledWithMatch(Testplane.prototype.readTests as SinonStub, sinon.match.any, {
                    runnableOpts: {
                        saveLocations: true,
                    },
                });
            });
        });
    });

    [Formatters.LIST, Formatters.TREE].forEach(formatterName => {
        describe(`${formatterName} formatter`, () => {
            beforeEach(() => {
                sandbox.stub(TestCollection, "create").returns(Object.create(TestCollection.prototype));
                sandbox.stub(TestCollection.prototype, "format").returns([]);
            });

            it("should send result to stdout", async () => {
                await listTests_(`--formatter ${formatterName}`);

                assert.calledOnceWith(console.info, JSON.stringify([]));
            });

            it("should save result to output file", async () => {
                await listTests_(`--formatter ${formatterName} --output-file ./folder/file.json`);

                (fs.ensureDir as SinonStub).calledOnceWith("./folder");
                (fs.writeJson as SinonStub).calledOnceWith("./folder/file.json", []);
            });
        });
    });
});
