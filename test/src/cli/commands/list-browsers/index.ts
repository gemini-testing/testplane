import { Command } from "@gemini-testing/commander";
import sinon, { SinonStub } from "sinon";

import logger from "../../../../../src/utils/logger";
import { Testplane } from "../../../../../src/testplane";
import * as testplaneCli from "../../../../../src/cli";

describe("cli/commands/list-browsers", () => {
    const sandbox = sinon.createSandbox();

    let testplaneStub: Testplane;
    let loggerErrorStub: SinonStub;
    let consoleInfoStub: SinonStub;

    const listBrowsers_ = async (options: string[] = [], cli: { run: VoidFunction } = testplaneCli): Promise<void> => {
        process.argv = ["foo/bar/node", "foo/bar/script", "list-browsers", ...options];
        cli.run();

        await (Command.prototype.action as SinonStub).lastCall.returnValue;
    };

    beforeEach(() => {
        testplaneStub = Object.create(Testplane.prototype);

        Object.defineProperty(testplaneStub, "config", {
            value: {
                browsers: {
                    "my-chrome": { desiredCapabilities: { browserName: "chrome", browserVersion: "109.0" } },
                    "my-safari": { desiredCapabilities: { browserName: "safari" } },
                },
            },
            writable: true,
            configurable: true,
        });

        sandbox.stub(Testplane, "create").returns(testplaneStub);

        loggerErrorStub = sandbox.stub(logger, "error");
        consoleInfoStub = sandbox.stub(console, "info");
        sandbox.stub(process, "exit");

        sandbox.spy(Command.prototype, "action");
    });

    afterEach(() => sandbox.restore());

    it("should exit with code 0", async () => {
        await listBrowsers_();

        assert.notCalled(loggerErrorStub);
        assert.calledOnceWith(process.exit as unknown as SinonStub, 0);
    });

    describe("list browsers", () => {
        it("should output browser tags in json format", async () => {
            testplaneStub.config.browsers = {
                "my-chrome": { desiredCapabilities: { browserName: "chrome", browserVersion: "109.0" } },
                "my-safari": { desiredCapabilities: { browserName: "safari" } },
            } as unknown as Testplane["config"]["browsers"];

            await listBrowsers_();

            const browserTags = [{ browserName: "chrome", browserVersion: "109.0" }, { browserName: "safari" }];

            assert.calledWith(consoleInfoStub, JSON.stringify(browserTags));
        });

        it("should output browser ids in json format", async () => {
            testplaneStub.config.browsers = {
                "my-chrome": { desiredCapabilities: { browserName: "chrome", browserVersion: "109.0" } },
                "my-safari": { desiredCapabilities: { browserName: "safari" } },
            } as unknown as Testplane["config"]["browsers"];

            await listBrowsers_(["--type", "ids"]);

            const browserIds = ["my-chrome", "my-safari"];

            assert.calledWith(consoleInfoStub, JSON.stringify(browserIds));
        });

        it("should output browser ids in plain format", async () => {
            testplaneStub.config.browsers = {
                "my-chrome": { desiredCapabilities: { browserName: "chrome", browserVersion: "109.0" } },
                "my-safari": { desiredCapabilities: { browserName: "safari" } },
            } as unknown as Testplane["config"]["browsers"];

            await listBrowsers_(["--type", "ids", "--format", "plain"]);

            assert.calledWith(consoleInfoStub, "my-chrome my-safari");
        });

        it("should output browser tags in plain format", async () => {
            testplaneStub.config.browsers = {
                "my-chrome": { desiredCapabilities: { browserName: "chrome", browserVersion: "109.0" } },
                "my-safari": { desiredCapabilities: { browserName: "safari" } },
            } as unknown as Testplane["config"]["browsers"];

            await listBrowsers_(["--format", "plain"]);

            assert.calledWith(consoleInfoStub, "chrome@109.0 safari");
        });

        it("should throw error if format is invalid", async () => {
            testplaneStub.config.browsers = {
                "my-chrome": { desiredCapabilities: { browserName: "chrome", browserVersion: "109.0" } },
                "my-safari": { desiredCapabilities: { browserName: "safari" } },
            } as unknown as Testplane["config"]["browsers"];

            await listBrowsers_(["--format", "plan"]);

            const errorMessage = '"format" option must be one of: "json", "plain", but got "plan"';

            assert.calledOnceWith(loggerErrorStub, sinon.match(errorMessage));
            assert.calledOnceWith(process.exit as unknown as SinonStub, 1);
        });

        it("should throw error if type is invalid", async () => {
            testplaneStub.config.browsers = {
                "my-chrome": { desiredCapabilities: { browserName: "chrome", browserVersion: "109.0" } },
                "my-safari": { desiredCapabilities: { browserName: "safari" } },
            } as unknown as Testplane["config"]["browsers"];

            await listBrowsers_(["--type", "id"]);

            const errorMessage = '"type" option must be one of: "ids", "tags", but got "id"';

            assert.calledOnceWith(loggerErrorStub, sinon.match(errorMessage));
            assert.calledOnceWith(process.exit as unknown as SinonStub, 1);
        });
    });
});
