import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { Testplane } from "../../../../../src/testplane";

describe("cli/commands/selectivity-merge-dumps", () => {
    const sandbox = sinon.createSandbox();

    let registerCmd: typeof import("src/cli/commands/selectivity-merge-dumps/index").registerCmd;
    let mergeSelectivityDumpsStub: SinonStub;
    let loggerStub: { error: SinonStub };

    let cliToolMock: {
        command: SinonStub;
        description: SinonStub;
        option: SinonStub;
        action: SinonStub;
    };
    let actionHandler: (sourcePaths: string[], options: Record<string, unknown>) => Promise<void>;
    let testplaneMock: Testplane;

    beforeEach(() => {
        mergeSelectivityDumpsStub = sandbox.stub().resolves();
        loggerStub = { error: sandbox.stub() };

        cliToolMock = {
            command: sandbox.stub(),
            description: sandbox.stub(),
            option: sandbox.stub(),
            action: sandbox.stub(),
        };
        cliToolMock.command.returns(cliToolMock);
        cliToolMock.description.returns(cliToolMock);
        cliToolMock.option.returns(cliToolMock);
        cliToolMock.action.callsFake((fn: typeof actionHandler) => {
            actionHandler = fn;
            return cliToolMock;
        });

        testplaneMock = {
            config: {
                selectivity: {
                    testDependenciesPath: "/default/deps/path",
                    compression: "none",
                },
            },
        } as unknown as Testplane;

        sandbox.stub(process, "exit");

        registerCmd = proxyquire("src/cli/commands/selectivity-merge-dumps/index", {
            "../../../browser/cdp/selectivity/merge-dumps": {
                mergeSelectivityDumps: mergeSelectivityDumpsStub,
            },
            "../../../utils/logger": loggerStub,
        }).registerCmd;
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("should register command with correct name", () => {
        registerCmd(cliToolMock as any, testplaneMock);

        assert.calledOnceWith(cliToolMock.command, "selectivity-merge-dumps [paths...]");
    });

    it("should set description", () => {
        registerCmd(cliToolMock as any, testplaneMock);

        assert.calledOnce(cliToolMock.description);
    });

    it("should register config option", () => {
        registerCmd(cliToolMock as any, testplaneMock);

        assert.calledWith(cliToolMock.option, "-c, --config <path>", sinon.match.string);
    });

    it("should register destination option", () => {
        registerCmd(cliToolMock as any, testplaneMock);

        assert.calledWith(cliToolMock.option, "-d, --destination <destination>", sinon.match.string);
    });

    describe("action", () => {
        beforeEach(() => {
            registerCmd(cliToolMock as any, testplaneMock);
        });

        it("should call mergeSelectivityDumps with provided destination", async () => {
            await actionHandler(["src1", "src2"], { destination: "/custom/dest" } as any);

            assert.calledOnceWith(mergeSelectivityDumpsStub, "/custom/dest", ["src1", "src2"], "none");
        });

        it("should use testDependenciesPath from config when destination is not provided", async () => {
            await actionHandler(["src1"], {} as any);

            assert.calledOnceWith(mergeSelectivityDumpsStub, "/default/deps/path", ["src1"], "none");
        });

        it("should pass compression from config", async () => {
            (testplaneMock.config as any).selectivity.compression = "gz";

            await actionHandler(["src1"], { destination: "/dest" } as any);

            assert.calledOnceWith(mergeSelectivityDumpsStub, "/dest", ["src1"], "gz");
        });

        it("should exit with code 0 on success", async () => {
            await actionHandler(["src1"], { destination: "/dest" } as any);

            assert.calledOnceWith(process.exit as unknown as SinonStub, 0);
        });

        it("should exit with code 1 on error", async () => {
            mergeSelectivityDumpsStub.rejects(new Error("merge failed"));

            await actionHandler(["src1"], { destination: "/dest" } as any);

            assert.calledOnceWith(process.exit as unknown as SinonStub, 1);
        });

        it("should log error stack on failure", async () => {
            const error = new Error("merge failed");
            mergeSelectivityDumpsStub.rejects(error);

            await actionHandler(["src1"], { destination: "/dest" } as any);

            assert.calledOnceWith(loggerStub.error, error.stack);
        });

        it("should log error itself when stack is not available", async () => {
            const error = "string error without stack";
            mergeSelectivityDumpsStub.rejects(error);

            await actionHandler(["src1"], { destination: "/dest" } as any);

            assert.calledOnce(loggerStub.error);
        });

        it("should pass multiple source paths", async () => {
            await actionHandler(["src1", "src2", "src3"], { destination: "/dest" } as any);

            assert.calledOnceWith(mergeSelectivityDumpsStub, "/dest", ["src1", "src2", "src3"], "none");
        });

        it("should pass empty source paths array", async () => {
            await actionHandler([], { destination: "/dest" } as any);

            assert.calledOnceWith(mergeSelectivityDumpsStub, "/dest", [], "none");
        });
    });
});
