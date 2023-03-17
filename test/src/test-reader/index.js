"use strict";

const TestReader = require("src/test-reader");
const { TestParser } = require("src/test-reader/test-parser");
const Events = require("src/constants/runner-events");
const SetsBuilder = require("src/test-reader/sets-builder");
const SetCollection = require("src/test-reader/sets-builder/set-collection");
const { makeConfigStub } = require("../../utils");
const _ = require("lodash");

describe("test-reader", () => {
    const sandbox = sinon.sandbox.create();

    const readTests_ = ({ opts, config, reader } = {}) => {
        opts = _.defaults(opts, {
            paths: [],
            sets: [],
            ignore: [],
            browsers: [],
            grep: undefined,
        });

        config = config || makeConfigStub();
        reader = reader || TestReader.create(config);

        return reader.read(opts);
    };

    beforeEach(() => {
        sandbox.spy(SetsBuilder, "create");
        sandbox.stub(SetsBuilder.prototype, "useFiles").returnsThis();
        sandbox.stub(SetsBuilder.prototype, "useSets").returnsThis();
        sandbox.stub(SetsBuilder.prototype, "useBrowsers").returnsThis();
        sandbox.stub(SetsBuilder.prototype, "build").callsFake(() => SetCollection.create());

        sandbox.stub(SetCollection.prototype, "getAllFiles").returns([]);
        sandbox.stub(SetCollection.prototype, "groupByBrowser").callsFake(() => {
            const config = TestReader.create.lastCall.args[0];
            const browsers = config.getBrowserIds();
            return _.fromPairs(browsers.map(p => [p, []]));
        });

        sandbox.stub(TestParser.prototype, "loadFiles").resolves();
        sandbox.stub(TestParser.prototype, "parse").returns([{ title: "default-test" }]);

        sandbox.spy(TestReader, "create");
    });

    afterEach(() => {
        sandbox.restore();

        delete process.env.HERMIONE_SETS;
    });

    describe("read", async () => {
        it("should create set-builder with sets from config and default directory", async () => {
            const defaultDir = require("../../../package").name;

            await readTests_({
                config: makeConfigStub({
                    sets: {
                        all: {},
                    },
                }),
            });

            assert.calledOnce(SetsBuilder.create);
            assert.calledWithMatch(SetsBuilder.create, { all: {} }, { defaultDir });
        });

        it("should use passed paths", async () => {
            await readTests_({ opts: { paths: ["some/path"] } });

            assert.calledOnceWith(SetsBuilder.prototype.useFiles, ["some/path"]);
        });

        it("should use passed sets", async () => {
            await readTests_({ opts: { sets: ["set1"] } });

            assert.calledOnceWith(SetsBuilder.prototype.useSets, ["set1"]);
        });

        it("should use sets from environment variable HERMIONE_SETS", async () => {
            process.env.HERMIONE_SETS = "set1,set2";

            await readTests_({ opts: { sets: null } });

            assert.calledOnceWith(SetsBuilder.prototype.useSets, ["set1", "set2"]);
        });

        it("should concat passed sets with sets from environment variable HERMIONE_SETS", async () => {
            process.env.HERMIONE_SETS = "set2";

            await readTests_({ opts: { sets: ["set1"] } });

            assert.calledOnceWith(SetsBuilder.prototype.useSets, ["set1", "set2"]);
        });

        it("should use pased browsers", async () => {
            await readTests_({ opts: { browsers: ["bro1"] } });

            assert.calledOnceWith(SetsBuilder.prototype.useBrowsers, ["bro1"]);
        });

        it("should build set-collection using working directory", async () => {
            await readTests_();

            assert.calledOnceWith(SetsBuilder.prototype.build, process.cwd());
        });

        it("should pass ignore files to build", async () => {
            await readTests_({ opts: { ignore: "foo/bar" } });

            assert.calledOnceWith(SetsBuilder.prototype.build, sinon.match.any, { ignore: "foo/bar" });
        });

        it("should pass file extensions to build from config", async () => {
            const fileExtensions = [".foo", ".bar"];

            await readTests_({
                config: makeConfigStub({
                    system: { fileExtensions },
                }),
            });

            assert.calledOnceWith(SetsBuilder.prototype.build, sinon.match.any, sinon.match.any, fileExtensions);
        });

        it("should call set-builder methods in rigth order", async () => {
            await readTests_();

            assert.callOrder(
                SetsBuilder.create,
                SetsBuilder.prototype.useFiles,
                SetsBuilder.prototype.useSets,
                SetsBuilder.prototype.useBrowsers,
                SetsBuilder.prototype.build,
            );
        });

        ["BEFORE_FILE_READ", "AFTER_FILE_READ"].forEach(event => {
            it(`should passthrough ${event} event from test reader`, async () => {
                const onEvent = sinon.spy().named(`on${event}`);
                const reader = TestReader.create(makeConfigStub({ browsers: ["bro"] })).on(Events[event], onEvent);

                TestParser.prototype.loadFiles.callsFake(function () {
                    this.emit(Events[event], { foo: "bar" });
                });

                await readTests_({ reader });

                assert.calledOnceWith(onEvent, { foo: "bar" });
            });
        });

        it("should laod all files", async () => {
            const config = makeConfigStub();
            const files = ["file1.js", "file2.js"];
            SetCollection.prototype.getAllFiles.returns(files);

            await readTests_({ config });

            assert.calledOnceWith(TestParser.prototype.loadFiles, files, config);
        });

        it("should load files before parsing", async () => {
            const config = makeConfigStub({ browsers: ["bro"] });

            await readTests_({ config });

            assert.callOrder(TestParser.prototype.loadFiles, TestParser.prototype.parse);
        });

        it("should group files by browser", async () => {
            await readTests_();

            assert.calledOnce(SetCollection.prototype.groupByBrowser);
        });

        it("should parse files for each browser", async () => {
            SetCollection.prototype.groupByBrowser.returns({
                bro1: ["common/file", "file1"],
                bro2: ["common/file", "file2"],
            });

            const config = makeConfigStub({ browsers: ["bro1", "bro2"] });
            const bro1Config = { foo: "bar" };
            const bro2Config = { baz: "qux" };
            config.forBrowser.withArgs("bro1").returns(bro1Config).withArgs("bro2").returns(bro2Config);

            const grep = "foo bar";

            await readTests_({ config, opts: { grep } });

            assert.calledTwice(TestParser.prototype.parse);
            assert.calledWith(TestParser.prototype.parse, ["common/file", "file1"], {
                browserId: "bro1",
                config: bro1Config,
                grep,
            });
            assert.calledWith(TestParser.prototype.parse, ["common/file", "file2"], {
                browserId: "bro2",
                config: bro2Config,
                grep,
            });
        });

        it("should return parsed tests grouped by browser", async () => {
            SetCollection.prototype.groupByBrowser.returns({
                bro1: ["file1"],
                bro2: ["file2"],
            });

            const test1 = { title: "test1" };
            const test2 = { title: "test2" };
            const test3 = { title: "test3" };
            const test4 = { title: "test4" };

            TestParser.prototype.parse
                .withArgs(["file1"])
                .returns([test1, test2])
                .withArgs(["file2"])
                .returns([test3, test4]);

            const config = makeConfigStub({ browsers: ["bro1", "bro2"] });
            const specs = await readTests_({ config });

            assert.deepEqual(specs, {
                bro1: [test1, test2],
                bro2: [test3, test4],
            });
        });

        describe("if there are no tests found", () => {
            beforeEach(() => {
                TestParser.prototype.parse.returns([]);
            });

            it("should throw error", async () => {
                await assert.isRejected(readTests_(), "There are no tests found");
            });

            [
                { name: "paths", value: ["path1, path2"], expectedMsg: "- paths: path1, path2\n" },
                { name: "browsers", value: ["bro1", "bro2"], expectedMsg: "- browsers: bro1, bro2\n" },
                { name: "ignore", value: "ignore1", expectedMsg: "- ignore: ignore1\n" },
                { name: "sets", value: ["set1", "set2"], expectedMsg: "- sets: set1, set2\n" },
                { name: "grep", value: "grep1", expectedMsg: "- grep: grep1\n" },
            ].forEach(({ name, value, expectedMsg }) => {
                it(`should correctly print passed option ${name}`, async () => {
                    try {
                        await readTests_({ opts: { [`${name}`]: value } });
                    } catch (e) {
                        assert.equal(e.message, "There are no tests found by the specified options:\n" + expectedMsg);
                    }
                });
            });

            it(`should correctly print several passed options that have a value`, async () => {
                const opts = {
                    paths: ["path1", "path2"],
                    browsers: ["browser1", "browser2"],
                    ignore: undefined,
                    sets: [],
                };

                try {
                    await readTests_({ opts: opts });
                } catch (e) {
                    assert.equal(
                        e.message,
                        "There are no tests found by the specified options:\n" +
                            "- paths: path1, path2\n- browsers: browser1, browser2\n",
                    );
                }
            });

            it("should print supported options if none are specified", async () => {
                await assert.isRejected(readTests_(), "Try to specify [paths, sets, ignore, browsers, grep] options");
            });

            it("should throw error if there are only silently skipped tests", async () => {
                TestParser.prototype.parse.returns([{ title: "foo", silentSkip: true }]);

                try {
                    await readTests_({ opts: { grep: "foo" } });
                } catch (e) {
                    assert.equal(e.message, "There are no tests found by the specified options:\n" + "- grep: foo\n");
                }
            });
        });
    });
});
