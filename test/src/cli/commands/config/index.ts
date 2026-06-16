import { Command } from "@gemini-testing/commander";
import sinon, { type SinonStub, type SinonSpy } from "sinon";

import { Testplane } from "../../../../../src/testplane";
import * as testplaneCli from "../../../../../src/cli";

describe("cli/commands/config", () => {
    const sandbox = sinon.createSandbox();

    let testplaneStub: Testplane;
    let consoleInfoStub: SinonStub;
    let jsonStringifyStub: SinonSpy;

    const config_ = async (options: string[] = [], cli: { run: () => Promise<void> } = testplaneCli): Promise<void> => {
        process.argv = ["foo/bar/node", "foo/bar/script", "config", ...options];
        await cli.run();

        await (Command.prototype.action as SinonStub).lastCall.returnValue;
    };

    beforeEach(() => {
        testplaneStub = Object.create(Testplane.prototype);

        sandbox.stub(Testplane, "create").resolves(testplaneStub);

        consoleInfoStub = sandbox.stub(console, "info");
        jsonStringifyStub = sandbox.spy(JSON, "stringify");

        sandbox.stub(process, "exit");

        sandbox.spy(Command.prototype, "action");
    });

    afterEach(() => sandbox.restore());

    it("should exit with code 0", async () => {
        await config_();

        assert.calledOnceWith(process.exit as unknown as SinonStub, 0);
    });

    it("should output testplane config", async () => {
        await config_();

        assert.calledWith(jsonStringifyStub, testplaneStub.config, null, 0);
        assert.calledOnceWith(consoleInfoStub, JSON.stringify(testplaneStub.config, null, 0));
    });

    it("should output testplane config with spacing", async () => {
        await config_(["--space", "4"]);

        assert.calledWith(jsonStringifyStub, testplaneStub.config, null, 4);
        assert.calledOnceWith(consoleInfoStub, JSON.stringify(testplaneStub.config, null, 4));
    });
});
