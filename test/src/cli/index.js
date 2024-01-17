"use strict";

const { Command } = require("@gemini-testing/commander");
const proxyquire = require("proxyquire").noCallThru();
const hermioneCli = require("src/cli");
const info = require("src/cli/info");
const defaults = require("src/config/defaults");
const { Hermione } = require("src/hermione");
const logger = require("src/utils/logger");

const any = sinon.match.any;

describe("cli", () => {
    const sandbox = sinon.sandbox.create();

    const run_ = async (argv = "", cli) => {
        process.argv = ["foo/bar/node", "foo/bar/script", ...argv.split(" ")];

        cli = cli || hermioneCli;
        cli.run();

        await Command.prototype.action.lastCall.returnValue;
    };

    beforeEach(() => {
        sandbox.stub(Hermione, "create").returns(Object.create(Hermione.prototype));
        sandbox.stub(Hermione.prototype, "run").resolves();
        sandbox.stub(Hermione.prototype, "extendCli");

        sandbox.stub(logger, "log");
        sandbox.stub(logger, "error");
        sandbox.stub(logger, "warn");

        sandbox.stub(process, "exit");

        sandbox.spy(Command.prototype, "action");
    });

    afterEach(() => sandbox.restore());

    it('should show information about config overriding on "--help"', async () => {
        await run_("--help");

        assert.calledOnce(logger.log);
        assert.calledWith(logger.log, info.configOverriding);
    });

    it("should create Hermione instance", async () => {
        await run_();

        assert.calledOnce(Hermione.create);
    });

    it('should require modules specified in "require" option', async () => {
        const requireModule = sandbox.stub();
        const stubHermioneCli = proxyquire("src/cli", {
            "../utils/module": { requireModule },
        });

        await run_("--require foo", stubHermioneCli);

        assert.calledOnceWith(requireModule, "foo");
    });

    it("should create Hermione without config by default", async () => {
        await run_();

        assert.calledWith(Hermione.create, undefined);
    });

    it("should use config path from cli", async () => {
        await run_("--config .conf.hermione.js");

        assert.calledWith(Hermione.create, ".conf.hermione.js");
    });

    it("should run hermione", async () => {
        await run_();

        assert.calledOnce(Hermione.prototype.run);
    });

    it("should run hermione with paths from args", async () => {
        await run_("first.hermione.js second.hermione.js");

        assert.calledWith(Hermione.prototype.run, ["first.hermione.js", "second.hermione.js"]);
    });

    it("should use default reporters when running hermione", async () => {
        await run_();

        assert.calledWithMatch(Hermione.prototype.run, any, { reporters: defaults.reporters });
    });

    it("should use reporters from cli", async () => {
        await run_("--reporter first --reporter second");

        assert.calledWithMatch(Hermione.prototype.run, any, { reporters: ["first", "second"] });
    });

    it("should not pass any browsers if they were not specified from cli", async () => {
        await run_();

        assert.calledWithMatch(Hermione.prototype.run, any, { browsers: undefined });
    });

    it("should use browsers from cli", async () => {
        await run_("--browser first --browser second");

        assert.calledWithMatch(Hermione.prototype.run, any, { browsers: ["first", "second"] });
    });

    describe("grep", () => {
        it("should not pass any grep rule if it was not specified from cli", async () => {
            await run_();

            assert.calledWithMatch(Hermione.prototype.run, any, { grep: undefined });
        });

        it("should convert grep rule to regexp", async () => {
            await run_("--grep some-rule");

            assert.calledWithMatch(
                Hermione.prototype.run,
                any,
                sinon.match({
                    grep: sinon.match.instanceOf(RegExp),
                }),
            );
        });

        it("should use grep rule from cli", async () => {
            await run_("--grep some-rule");

            assert.isTrue(Hermione.prototype.run.firstCall.args[1].grep.test("some-rule"));
        });

        it("should accept invalid regex", async () => {
            await run_("--grep (foo|bar");

            assert.isTrue(Hermione.prototype.run.firstCall.args[1].grep.test("(foo|bar"));
        });

        it("should warn about invalid regex", async () => {
            await run_("--grep (foo|bar");

            assert.calledOnceWith(logger.warn, sinon.match("(foo|bar"));
        });
    });

    it("should use update refs mode from cli", async () => {
        await run_("--update-refs");

        assert.calledWithMatch(Hermione.prototype.run, any, { updateRefs: true });
    });

    it("should use require modules from cli", async () => {
        const stubHermioneCli = proxyquire("src/cli", {
            "../utils/module": { requireModule: sandbox.stub() },
        });
        await run_("--require foo", stubHermioneCli);

        assert.calledWithMatch(Hermione.prototype.run, any, { requireModules: ["foo"] });
    });

    it("should allow hermione to extend cli", async () => {
        await run_();

        assert.calledOnceWith(Hermione.prototype.extendCli, sinon.match.instanceOf(Command));
    });

    it("should extend cli before parse", async () => {
        sandbox.spy(Command.prototype, "parse");

        await run_();

        assert.callOrder(Hermione.prototype.extendCli, Command.prototype.parse);
    });

    it("should exit with code 0 if tests pass", async () => {
        Hermione.prototype.run.resolves(true);

        await run_();

        assert.calledWith(process.exit, 0);
    });

    it("should exit with code 1 if tests fail", async () => {
        Hermione.prototype.run.resolves(false);

        await run_();

        assert.calledWith(process.exit, 1);
    });

    it("should exit with code 1 on reject", async () => {
        Hermione.prototype.run.rejects();

        await run_();

        assert.calledWith(process.exit, 1);
    });

    it("should log an error stack on reject", async () => {
        Hermione.prototype.run.rejects({ stack: "some-stack" });

        await run_();

        assert.calledWith(logger.error, "some-stack");
    });

    it("should log an error on reject if stack does not exist", async () => {
        const err = new Error("some-error");
        err.stack = undefined;
        Hermione.prototype.run.rejects(err);

        await run_();

        assert.calledWithMatch(logger.error, err);
    });

    it("should turn on debug mode from cli", async () => {
        await run_("--inspect");

        assert.calledWithMatch(Hermione.prototype.run, any, { inspectMode: { inspect: true } });
    });

    it("should turn on debug mode from cli with params", async () => {
        await run_("--inspect-brk 9229");

        assert.calledWithMatch(Hermione.prototype.run, any, { inspectMode: { inspectBrk: "9229" } });
    });

    describe("repl mode", () => {
        it("should be disabled by default", async () => {
            await run_();

            assert.calledWithMatch(Hermione.prototype.run, any, {
                replMode: {
                    enabled: false,
                    beforeTest: false,
                    onFail: false,
                },
            });
        });

        it('should be enabled when specify "repl" flag', async () => {
            await run_("--repl");

            assert.calledWithMatch(Hermione.prototype.run, any, {
                replMode: {
                    enabled: true,
                    beforeTest: false,
                    onFail: false,
                },
            });
        });

        it('should be enabled when specify "beforeTest" flag', async () => {
            await run_("--repl-before-test");

            assert.calledWithMatch(Hermione.prototype.run, any, {
                replMode: {
                    enabled: true,
                    beforeTest: true,
                    onFail: false,
                },
            });
        });

        it('should be enabled when specify "onFail" flag', async () => {
            await run_("--repl-on-fail");

            assert.calledWithMatch(Hermione.prototype.run, any, {
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

        assert.calledWithMatch(Hermione.prototype.run, any, { devtools: true });
    });
});
