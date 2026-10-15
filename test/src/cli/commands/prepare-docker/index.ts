import { Command } from "@gemini-testing/commander";
import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import { Config } from "src/config";
import type { Testplane } from "src/testplane";

describe("cli/commands/prepare-docker", () => {
    const sandbox = sinon.createSandbox();
    const originalExitCode = process.exitCode;
    let prepare: SinonStub;
    let logger: { log: SinonStub; error: SinonStub };
    let config: Config;
    let cli: Command;
    let completion: Promise<void>;

    const run = async (...args: string[]): Promise<void> => {
        cli.parse(["node", "testplane", "prepare-docker", ...args]);
        await completion;
    };

    beforeEach(async () => {
        process.exitCode = undefined;
        sandbox.stub(process, "env").value({ ...process.env, TESTPLANE_SETS: "", HERMIONE_SETS: "" });
        prepare = sandbox.stub().resolves();
        logger = { log: sandbox.stub(), error: sandbox.stub() };
        config = await Config.create({
            docker: { selenoidImage: "selenoid:shared" },
            browsers: {
                chrome: {
                    gridUrl: "docker",
                    docker: { image: "chrome:1" },
                    desiredCapabilities: { browserName: "chrome" },
                },
                firefox: {
                    gridUrl: "docker",
                    docker: { image: "firefox:1", selenoidImage: "selenoid:custom" },
                    desiredCapabilities: { browserName: "firefox" },
                },
                remote: {
                    gridUrl: "http://localhost:4444/wd/hub",
                    desiredCapabilities: { browserName: "chrome" },
                },
                local: { gridUrl: "local", desiredCapabilities: { browserName: "chrome" } },
            },
        });
        const testplane = {
            config,
            profileCliCommand: async (_name: string, fn: () => Promise<void>) => fn(),
        } as unknown as Testplane;
        const originalAction = Command.prototype.action;
        sandbox.stub(Command.prototype, "action").callsFake(function (this: Command, fn: (cmd: Command) => void) {
            return originalAction.call(this, (cmd: Command) => {
                completion = Promise.resolve(fn(cmd));
            });
        });
        const { registerCmd } = proxyquire("src/cli/commands/prepare-docker", {
            "../../../browser/docker": { prepareDockerImages: prepare },
            "../../../utils/logger": logger,
        });
        cli = new Command("testplane");
        registerCmd(cli, testplane);
    });

    afterEach(() => {
        process.exitCode = originalExitCode;
        sandbox.restore();
    });

    it("should prepare only Docker browsers with resolved global and per-browser controller images", async () => {
        await run();

        assert.calledTwice(prepare);
        assert.calledWithMatch(prepare, { image: "chrome:1", selenoidImage: "selenoid:shared" }, "chrome", "chrome");
        assert.calledWithMatch(prepare, { image: "firefox:1", selenoidImage: "selenoid:custom" }, "firefox", "firefox");
        assert.isUndefined(process.exitCode);
    });

    it("should ignore Docker browsers excluded from all configured sets, even without docker options", async () => {
        config.forBrowser("firefox").docker = null;
        config.sets = {
            desktop: { files: ["not-read/**/*.ts"], ignoreFiles: [], browsers: ["chrome", "remote"] },
            other: { files: [], ignoreFiles: [], browsers: ["chrome", "local"] },
        };
        prepare.callsFake(async docker => {
            if (!docker?.image) throw new Error("Missing docker.image");
        });

        await run();

        assert.calledOnce(prepare);
        assert.calledWith(prepare, config.forBrowser("chrome").docker, "chrome", "chrome");
        assert.notCalled(logger.error);
        assert.isUndefined(process.exitCode);
    });

    it("should select only browsers in the requested sets", async () => {
        config.sets = {
            desktop: { files: [], ignoreFiles: [], browsers: ["chrome"] },
            other: { files: [], ignoreFiles: [], browsers: ["firefox"] },
        };

        await run("--set", "other");

        assert.calledOnce(prepare);
        assert.calledWith(prepare, config.forBrowser("firefox").docker, "firefox", "firefox");
    });

    it("should intersect the browser filter with the selected sets", async () => {
        config.sets = {
            desktop: { files: [], ignoreFiles: [], browsers: ["chrome"] },
            other: { files: [], ignoreFiles: [], browsers: ["firefox"] },
        };

        await run("-s", "desktop", "-b", "firefox");

        assert.notCalled(prepare);
        assert.isUndefined(process.exitCode);
    });

    it("should not fall back to all browsers when the sets have empty browser lists", async () => {
        config.sets = { empty: { files: [], ignoreFiles: [], browsers: [] } };

        await run();

        assert.notCalled(prepare);
        assert.isUndefined(process.exitCode);
    });

    for (const variable of ["TESTPLANE_SETS", "HERMIONE_SETS"]) {
        it(`should combine CLI set selection with ${variable}`, async () => {
            config.sets = {
                desktop: { files: [], ignoreFiles: [], browsers: ["chrome"] },
                other: { files: [], ignoreFiles: [], browsers: ["firefox"] },
                unused: { files: [], ignoreFiles: [], browsers: ["remote"] },
            };
            delete process.env.TESTPLANE_SETS;
            delete process.env.HERMIONE_SETS;
            process.env[variable] = "other";

            await run("--set", "desktop");

            assert.calledTwice(prepare);
        });
    }

    it("should support repeated set selection without preparing duplicate browsers", async () => {
        config.sets = {
            desktop: { files: [], ignoreFiles: [], browsers: ["chrome"] },
            other: { files: [], ignoreFiles: [], browsers: ["chrome", "firefox"] },
        };

        await run("--set", "desktop", "-s", "other", "-s", "other");

        assert.calledTwice(prepare);
    });

    it("should reject unknown sets before calling Docker", async () => {
        await run("--set", "typo");

        assert.notCalled(prepare);
        assert.calledWith(logger.error, sinon.match("No such sets: typo"));
        assert.equal(process.exitCode, 1);
    });

    it("should support repeated browser selection and ignore duplicate IDs", async () => {
        await run("-b", "firefox", "--browser", "firefox", "-b", "local");

        assert.calledOnce(prepare);
        assert.calledWith(prepare, config.forBrowser("firefox").docker, "firefox", "firefox");
    });

    it("should accept config and require options", async () => {
        await run("--config", "custom.ts", "--require", "ts-node/register", "-b", "chrome");

        assert.calledOnce(prepare);
    });

    it("should reject unknown browser IDs before preparing any images", async () => {
        await run("-b", "chrome", "-b", "typo");

        assert.notCalled(prepare);
        assert.calledWith(logger.error, sinon.match("Unknown browser: typo"));
        assert.equal(process.exitCode, 1);
    });

    it("should succeed without touching Docker when no Docker browsers are selected", async () => {
        await run("-b", "remote", "-b", "local");

        assert.notCalled(prepare);
        assert.calledWith(logger.log, 'No browsers with gridUrl: "docker" selected.');
        assert.isUndefined(process.exitCode);
    });

    it("should fail the command if an image cannot be prepared", async () => {
        prepare.rejects(new Error("Cannot pull image"));

        await run();

        assert.calledOnce(prepare);
        assert.calledWith(logger.error, sinon.match("Cannot pull image"));
        assert.equal(process.exitCode, 1);
    });

    it("should preserve a signal exit code on failure", async () => {
        process.exitCode = 143;
        prepare.rejects(new Error("Cannot build image"));

        await run();

        assert.equal(process.exitCode, 143);
    });
});
