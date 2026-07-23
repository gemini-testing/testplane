import { resolveExitCode } from "../../../src/utils/exit-code";

describe("utils/exit-code", () => {
    const originalExitCode = process.exitCode;

    const resolveWithRawExitCode = (exitCode: NodeJS.Process["exitCode"], fallback: number): number => {
        const originalProcess = global.process;
        const processStub = Object.create(originalProcess) as NodeJS.Process;

        Object.defineProperty(processStub, "exitCode", { value: exitCode });
        global.process = processStub;

        try {
            return resolveExitCode(fallback);
        } finally {
            global.process = originalProcess;
        }
    };

    afterEach(() => {
        process.exitCode = originalExitCode;
    });

    it("should use the requested exit code without a pending exit code", () => {
        process.exitCode = undefined;

        assert.equal(resolveExitCode(0), 0);
    });

    it("should preserve a pending ordinary nonzero exit code when fallback is successful", () => {
        process.exitCode = 2;

        assert.equal(resolveExitCode(0), 2);
    });

    it("should prefer a nonzero fallback to a pending non-signal exit code", () => {
        process.exitCode = 128;

        assert.equal(resolveExitCode(1), 1);
    });

    for (const signalExitCode of [129, 130, 143]) {
        it(`should preserve pending signal exit code ${signalExitCode}`, () => {
            process.exitCode = signalExitCode;

            assert.equal(resolveExitCode(1), signalExitCode);
        });
    }

    it("should preserve a canonical numeric-string ordinary exit code when fallback is successful", () => {
        assert.equal(resolveWithRawExitCode("2", 0), 2);
    });

    it("should preserve a canonical numeric-string signal exit code", () => {
        assert.equal(resolveWithRawExitCode("130", 1), 130);
    });

    it("should turn an invalid pending exit code into failure instead of wrapped success", () => {
        process.exitCode = 256;

        assert.equal(resolveExitCode(0), 1);
    });

    it("should turn an out-of-range numeric-string exit code into failure", () => {
        assert.equal(resolveWithRawExitCode("256", 0), 1);
    });

    it("should turn a noncanonical numeric-string exit code into failure", () => {
        assert.equal(resolveWithRawExitCode("02", 0), 1);
    });

    it("should turn an invalid fallback into failure instead of wrapped success", () => {
        process.exitCode = undefined;

        assert.equal(resolveExitCode(256), 1);
    });
});
