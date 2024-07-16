"use strict";

const { Command } = require("@gemini-testing/commander");
const proxyquire = require("proxyquire").noCallThru();
const testplaneCli = require("src/cli");
const info = require("src/cli/info");
const defaults = require("src/config/defaults");
const { Testplane } = require("src/testplane");
const logger = require("src/utils/logger");

const any = sinon.match.any;

describe("cli", () => {
    const sandbox = sinon.createSandbox();

    const run_ = async (argv = "", cli) => {
        process.argv = ["foo/bar/node", "foo/bar/script", ...argv.split(" ")];

        cli = cli || testplaneCli;
        cli.run();

        await Command.prototype.action.lastCall.returnValue;
    };

    beforeEach(() => {
        sandbox.stub(Testplane, "create").returns(Object.create(Testplane.prototype));
        sandbox.stub(Testplane.prototype, "run").resolves();
        sandbox.stub(Testplane.prototype, "extendCli");

        sandbox.stub(logger, "log");
        sandbox.stub(logger, "error");
        sandbox.stub(logger, "warn");

        sandbox.stub(process, "exit");

        sandbox.spy(Command.prototype, "action");
    });

    afterEach(() => sandbox.restore());

    describe("config overriding", () => {
        it('should show information about config overriding on "--help"', async () => {
            await run_("--help");

            assert.calledOnce(logger.log);
            assert.calledWith(logger.log, info.configOverriding());
        });

        it("should show information about testplane by default", async () => {
            const defaultResult = info.configOverriding();

            assert.isTrue(defaultResult.includes("testplane"));
            assert.isFalse(defaultResult.includes("hermione"));
        });

        it("should show information about hermione", async () => {
            const result = info.configOverriding({ cliName: "hermione" });

            assert.isTrue(result.includes("hermione"));
            assert.isFalse(result.includes("testplane"));
        });
    });

    it("should create Testplane instance", async () => {
        await run_();

        assert.calledOnce(Testplane.create);
    });

    it('should require modules specified in "require" option', async () => {
        const requireModule = sandbox.stub();
        const stubTestplaneCli = proxyquire("src/cli", {
            "../utils/module": { requireModule },
        });

        await run_("--require foo", stubTestplaneCli);

        assert.calledOnceWith(requireModule, "foo");
    });

    it("should create Testplane without config by default", async () => {
        await run_();

        assert.calledWith(Testplane.create, undefined);
    });

    it("should use config path from cli", async () => {
        await run_("--config .conf.testplane.js");

        assert.calledWith(Testplane.create, ".conf.testplane.js");
    });

    it("should run testplane", async () => {
        await run_();

        assert.calledOnce(Testplane.prototype.run);
    });

    it("should run testplane with paths from args", async () => {
        await run_("first.testplane.js second.testplane.js");

        assert.calledWith(Testplane.prototype.run, ["first.testplane.js", "second.testplane.js"]);
    });

    it("should use default reporters when running testplane", async () => {
        await run_();

        assert.calledWithMatch(Testplane.prototype.run, any, { reporters: defaults.reporters });
    });

    it("should use reporters from cli", async () => {
        await run_("--reporter first --reporter second");

        assert.calledWithMatch(Testplane.prototype.run, any, { reporters: ["first", "second"] });
    });

    it("should not pass any browsers if they were not specified from cli", async () => {
        await run_();

        assert.calledWithMatch(Testplane.prototype.run, any, { browsers: undefined });
    });

    it("should use browsers from cli", async () => {
        await run_("--browser first --browser second");

        assert.calledWithMatch(Testplane.prototype.run, any, { browsers: ["first", "second"] });
    });

    describe("grep", () => {
        it("should not pass any grep rule if it was not specified from cli", async () => {
            await run_();

            assert.calledWithMatch(Testplane.prototype.run, any, { grep: undefined });
        });

        it("should convert grep rule to regexp", async () => {
            await run_("--grep some-rule");

            assert.calledWithMatch(
                Testplane.prototype.run,
                any,
                sinon.match({
                    grep: sinon.match.instanceOf(RegExp),
                }),
            );
        });

        it("should use grep rule from cli", async () => {
            await run_("--grep some-rule");

            assert.isTrue(Testplane.prototype.run.firstCall.args[1].grep.test("some-rule"));
        });

        it("should accept invalid regex", async () => {
            await run_("--grep (foo|bar");

            assert.isTrue(Testplane.prototype.run.firstCall.args[1].grep.test("(foo|bar"));
        });

        it("should warn about invalid regex", async () => {
            await run_("--grep (foo|bar");

            assert.calledOnceWith(logger.warn, sinon.match("(foo|bar"));
        });
    });

    it("should use update refs mode from cli", async () => {
        await run_("--update-refs");

        assert.calledWithMatch(Testplane.prototype.run, any, { updateRefs: true });
    });

    it("should use run failed mode from cli", async () => {
        await run_("--run-failed");

        assert.calledWithMatch(Testplane.prototype.run, any, { runFailed: true });
    });

    it("should use require modules from cli", async () => {
        const stubTestplaneCli = proxyquire("src/cli", {
            "../utils/module": { requireModule: sandbox.stub() },
        });
        await run_("--require foo", stubTestplaneCli);

        assert.calledWithMatch(Testplane.prototype.run, any, { requireModules: ["foo"] });
    });

    it("should allow testplane to extend cli", async () => {
        await run_();

        assert.calledOnceWith(Testplane.prototype.extendCli, sinon.match.instanceOf(Command));
    });

    it("should extend cli before parse", async () => {
        sandbox.spy(Command.prototype, "parse");

        await run_();

        assert.callOrder(Testplane.prototype.extendCli, Command.prototype.parse);
    });

    it("should exit with code 0 if tests pass", async () => {
        Testplane.prototype.run.resolves(true);

        await run_();

        assert.calledWith(process.exit, 0);
    });

    it("should exit with code 1 if tests fail", async () => {
        Testplane.prototype.run.resolves(false);

        await run_();

        assert.calledWith(process.exit, 1);
    });

    it("should exit with code 1 on reject", async () => {
        Testplane.prototype.run.rejects();

        await run_();

        assert.calledWith(process.exit, 1);
    });

    it("should log an error stack on reject", async () => {
        Testplane.prototype.run.rejects({ stack: "some-stack" });

        await run_();

        assert.calledWith(logger.error, "some-stack");
    });

    it("should log an error on reject if stack does not exist", async () => {
        const err = new Error("some-error");
        err.stack = undefined;
        Testplane.prototype.run.rejects(err);

        await run_();

        assert.calledWithMatch(logger.error, err);
    });

    it("should turn on debug mode from cli", async () => {
        await run_("--inspect");

        assert.calledWithMatch(Testplane.prototype.run, any, { inspectMode: { inspect: true } });
    });

    it("should turn on debug mode from cli with params", async () => {
        await run_("--inspect-brk 9229");

        assert.calledWithMatch(Testplane.prototype.run, any, { inspectMode: { inspectBrk: "9229" } });
    });

    describe("repl mode", () => {
        it("should be disabled by default", async () => {
            await run_();

            assert.calledWithMatch(Testplane.prototype.run, any, {
                replMode: {
                    enabled: false,
                    beforeTest: false,
                    onFail: false,
                },
            });
        });

        it('should be enabled when specify "repl" flag', async () => {
            await run_("--repl");

            assert.calledWithMatch(Testplane.prototype.run, any, {
                replMode: {
                    enabled: true,
                    beforeTest: false,
                    onFail: false,
                },
            });
        });

        it('should be enabled when specify "beforeTest" flag', async () => {
            await run_("--repl-before-test");

            assert.calledWithMatch(Testplane.prototype.run, any, {
                replMode: {
                    enabled: true,
                    beforeTest: true,
                    onFail: false,
                },
            });
        });

        it('should be enabled when specify "onFail" flag', async () => {
            await run_("--repl-on-fail");

            assert.calledWithMatch(Testplane.prototype.run, any, {
                replMode: {
                    enabled: true,
                    beforeTest: false,
                    onFail: true,
                },
            });
        });
    });

    it("should turn on devtools mode from cli", async () => {
        await run_("--devtools");

        assert.calledWithMatch(Testplane.prototype.run, any, { devtools: true });
    });
});
