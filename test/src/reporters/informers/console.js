const proxyquire = require("proxyquire");

describe("reporter/informers/console", () => {
    const sandbox = sinon.createSandbox();
    let ConsoleInformer;
    let loggerLogStub, loggerWarnStub, loggerErrorStub;

    beforeEach(() => {
        loggerLogStub = sandbox.stub();
        loggerWarnStub = sandbox.stub();
        loggerErrorStub = sandbox.stub();

        ConsoleInformer = proxyquire("src/reporters/informers/console", {
            "../../utils/logger": {
                log: loggerLogStub,
                warn: loggerWarnStub,
                error: loggerErrorStub,
            },
        });
    });

    afterEach(() => sandbox.restore());

    describe('"log" method', () => {
        it("should send log message to console", () => {
            ConsoleInformer.create().log("message");

            assert.calledOnceWith(loggerLogStub, "message");
        });
    });

    describe('"warn" method', () => {
        it("should send warn message to console", () => {
            ConsoleInformer.create().warn("message");

            assert.calledOnceWith(loggerWarnStub, "message");
        });
    });

    describe('"error" method', () => {
        it("should send error message to console", () => {
            ConsoleInformer.create().error("message");

            assert.calledOnceWith(loggerErrorStub, "message");
        });
    });

    describe('"end" method', () => {
        it("should do nothing if message is not passed", () => {
            ConsoleInformer.create().end();

            assert.notCalled(loggerLogStub);
        });

        it("should send end message to console", () => {
            ConsoleInformer.create().end("message");

            assert.calledOnceWith(loggerLogStub, "message");
        });
    });
});
