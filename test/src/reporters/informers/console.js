const logger = require("src/utils/logger");
const ConsoleInformer = require("src/reporters/informers/console");

describe("reporter/informers/console", () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(logger, "log");
        sandbox.stub(logger, "warn");
        sandbox.stub(logger, "error");
    });

    afterEach(() => sandbox.restore());

    describe('"log" method', () => {
        it("should send log message to console", () => {
            ConsoleInformer.create().log("message");

            assert.calledOnceWith(logger.log, "message");
        });
    });

    describe('"warn" method', () => {
        it("should send warn message to console", () => {
            ConsoleInformer.create().warn("message");

            assert.calledOnceWith(logger.warn, "message");
        });
    });

    describe('"error" method', () => {
        it("should send error message to console", () => {
            ConsoleInformer.create().error("message");

            assert.calledOnceWith(logger.error, "message");
        });
    });

    describe('"end" method', () => {
        it("should do nothing if message is not passed", () => {
            ConsoleInformer.create().end();

            assert.notCalled(logger.log);
        });

        it("should send end message to console", () => {
            ConsoleInformer.create().end("message");

            assert.calledOnceWith(logger.log, "message");
        });
    });
});
