"use strict";

const { Command } = require("@gemini-testing/commander");
const proxyquire = require("proxyquire").noCallThru();
const { configOverriding } = require("src/cli/info");
const defaults = require("src/config/defaults");
const { Testplane } = require("src/testplane");
const { collectCliValues, withCommonCliOptions } = require("src/utils/cli");

const any = sinon.match.any;

describe("cli", () => {
    const sandbox = sinon.createSandbox();
    const originalExitCode = process.exitCode;
    let testplaneCli;
    let loggerLogStub, loggerWarnStub, loggerErrorStub, getPortStub;
    let uncaughtExceptionHandler, unhandledRejectionHandler;

    const run_ = async (argv = "", cli) => {
        process.argv = ["foo/bar/node", "foo/bar/script", ...argv.split(" ")];

        cli = cli || testplaneCli;
        await cli.run();

        await Command.prototype.action.lastCall.returnValue;
    };

    beforeEach(() => {
        const uncaughtExceptionHandlers = process.listeners("uncaughtException");
        const unhandledRejectionHandlers = process.listeners("unhandledRejection");

        loggerLogStub = sandbox.stub();
        loggerWarnStub = sandbox.stub();
        loggerErrorStub = sandbox.stub();
        getPortStub = sandbox.stub().resolves(12345);

        testplaneCli = proxyquire("src/cli", {
            "../utils/cli": proxyquire("src/utils/cli", {
                "./logger": {
                    log: loggerLogStub,
                    warn: loggerWarnStub,
                    error: loggerErrorStub,
                },
            }),
            "../utils/logger": {
                log: loggerLogStub,
                warn: loggerWarnStub,
                error: loggerErrorStub,
            },
            "get-port": getPortStub,
        });

        uncaughtExceptionHandler = process
            .listeners("uncaughtException")
            .find(handler => !uncaughtExceptionHandlers.includes(handler));
        unhandledRejectionHandler = process
            .listeners("unhandledRejection")
            .find(handler => !unhandledRejectionHandlers.includes(handler));

        sandbox.stub(Testplane, "create").resolves(Object.create(Testplane.prototype));
        sandbox.stub(Testplane.prototype, "run").resolves();
        sandbox.stub(Testplane.prototype, "extendCli");

        sandbox.stub(process, "exit");

        sandbox.spy(Command.prototype, "action");
    });

    afterEach(() => {
        process.exitCode = originalExitCode;
        process.removeListener("uncaughtException", uncaughtExceptionHandler);
        process.removeListener("unhandledRejection", unhandledRejectionHandler);
        sandbox.restore();
    });

    describe("config overriding", () => {
        it('should show information about config overriding on "--help"', async () => {
            sandbox.stub(console, "log");

            await run_("--help");

            assert.calledOnce(console.log);
            assert.calledWith(console.log, configOverriding());
        });

        it("should show information about testplane by default", async () => {
            const defaultResult = configOverriding();

            assert.isTrue(defaultResult.includes("testplane"));
            assert.isFalse(defaultResult.includes("hermione"));
        });

        it("should show information about hermione", async () => {
            const result = configOverriding({ cliName: "hermione" });

            assert.isTrue(result.includes("hermione"));
            assert.isFalse(result.includes("testplane"));
        });
    });

    it("should create Testplane instance", async () => {
        await run_();

        assert.calledOnce(Testplane.create);
    });

    it('should require modules specified in "require" option', async () => {
        const handleRequires = sandbox.stub();
        const stubTestplaneCli = proxyquire("src/cli", {
            "../utils/cli": { handleRequires, withCommonCliOptions, collectCliValues },
        });

        await run_("--require foo", stubTestplaneCli);

        assert.calledOnceWith(handleRequires, ["foo"]);
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

    describe("tag", () => {
        it("should not pass any grep rule if it was not specified from cli", async () => {
            await run_();

            assert.calledWithMatch(Testplane.prototype.run, any, { tag: undefined });
        });

        it("should use tag rule from cli", async () => {
            await run_("--tag foo");

            console.log("Testplane.prototype.run.firstCall.args", Testplane.prototype.run.firstCall.args);

            assert.instanceOf(Testplane.prototype.run.firstCall.args[1].tag, Function);
        });
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

            assert.calledOnceWith(loggerWarnStub, sinon.match("(foo|bar"));
        });
    });

    it("should use update refs mode from cli", async () => {
        await run_("--update-refs");

        assert.calledWithMatch(Testplane.prototype.run, any, { updateRefs: true });
    });

    it("should use require modules from cli", async () => {
        const stubTestplaneCli = proxyquire("src/cli", {
            "../utils/cli": { handleRequires: sandbox.stub(), collectCliValues, withCommonCliOptions },
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

    it("should preserve a pending ordinary nonzero exit code if tests pass", async () => {
        Testplane.prototype.run.resolves(true);
        process.exitCode = 2;

        await run_();

        assert.calledWith(process.exit, 2);
    });

    it("should turn an invalid pending exit code into failure if tests pass", async () => {
        Testplane.prototype.run.resolves(true);
        process.exitCode = 256;

        await run_();

        assert.calledWith(process.exit, 1);
    });

    it("should exit with code 1 if tests fail", async () => {
        Testplane.prototype.run.resolves(false);

        await run_();

        assert.calledWith(process.exit, 1);
    });

    it("should preserve a signal exit code if tests fail", async () => {
        Testplane.prototype.run.resolves(false);
        const originalExitCode = process.exitCode;
        process.exitCode = 130;

        try {
            await run_();
        } finally {
            process.exitCode = originalExitCode;
        }

        assert.calledWith(process.exit, 130);
    });

    it("should exit with code 1 on reject", async () => {
        Testplane.prototype.run.rejects();

        await run_();

        assert.calledWith(process.exit, 1);
    });

    it("should preserve a signal exit code on reject", async () => {
        Testplane.prototype.run.rejects();
        const originalExitCode = process.exitCode;
        process.exitCode = 143;

        try {
            await run_();
        } finally {
            process.exitCode = originalExitCode;
        }

        assert.calledWith(process.exit, 143);
    });

    it("should set a failure exit code before halting on initialized unhandled rejection", async () => {
        const haltStub = sandbox.stub(Testplane.prototype, "halt").callsFake(() => {
            assert.equal(process.exitCode, 1);
        });
        const processedFlag = "__TESTPLANE_INTERNAL_UNHANDLED_REJECTION_PROCESSED";
        const originalProcessedFlag = global[processedFlag];
        process.exitCode = undefined;

        try {
            await run_();
            unhandledRejectionHandler(new Error("rejection"));
        } finally {
            if (originalProcessedFlag === undefined) {
                delete global[processedFlag];
            } else {
                global[processedFlag] = originalProcessedFlag;
            }
        }

        assert.calledOnce(haltStub);
    });

    it("should log an error stack on reject", async () => {
        Testplane.prototype.run.rejects({ stack: "some-stack" });

        await run_();

        assert.calledWith(loggerErrorStub, "some-stack");
    });

    it("should log an error on reject if stack does not exist", async () => {
        const err = new Error("some-error");
        err.stack = undefined;
        Testplane.prototype.run.rejects(err);

        await run_();

        assert.calledWithMatch(loggerErrorStub, err);
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
                    port: 0,
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
                    port: 12345,
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
                    port: 12345,
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
                    port: 12345,
                },
            });
        });

        it('should use passed port when specify "port" option', async () => {
            await run_("--repl --repl-port 33333");

            assert.notCalled(getPortStub);
            assert.calledWithMatch(Testplane.prototype.run, any, {
                replMode: {
                    enabled: true,
                    port: 33333,
                },
            });
        });

        it('should use random free port if "port" option is not specified', async () => {
            getPortStub.resolves(44444);

            await run_("--repl");

            assert.calledWithMatch(Testplane.prototype.run, any, {
                replMode: {
                    enabled: true,
                    port: 44444,
                },
            });
        });
    });

    describe("keep browser mode", () => {
        it("should be disabled by default", async () => {
            await run_();

            assert.calledWithMatch(Testplane.prototype.run, any, {
                keepBrowserMode: {
                    enabled: false,
                    onFail: false,
                },
            });
        });

        it('should be enabled when specify "keep-browser" flag', async () => {
            await run_("--keep-browser");

            assert.calledWithMatch(Testplane.prototype.run, any, {
                keepBrowserMode: {
                    enabled: true,
                    onFail: false,
                },
            });
        });

        it('should be enabled when specify "keep-browser-on-fail" flag', async () => {
            await run_("--keep-browser-on-fail");

            assert.calledWithMatch(Testplane.prototype.run, any, {
                keepBrowserMode: {
                    enabled: true,
                    onFail: true,
                },
            });
        });
    });

    it("should turn on local mode from cli", async () => {
        await run_("--local");

        assert.calledWithMatch(Testplane.prototype.run, any, { local: true });
    });
});
