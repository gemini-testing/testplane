import stripAnsi from "strip-ansi";
import { TestPreflightError } from "../../../src/errors/test-preflight-error";

describe("TestPreflightError", () => {
    it("should expose source frames and structured diagnostics to the CLI", () => {
        const diagnostic = {
            code: "missing-await" as const,
            file: "/test.ts",
            line: 2,
            column: 3,
            command: "assertView",
            message: "Add await",
        };
        const error = new TestPreflightError(
            [diagnostic],
            new Map([["/test.ts", "async function test() {\n  browser.assertView('plane');\n}\n"]]),
        );
        assert.deepEqual(error.diagnostics, [diagnostic]);
        assert.include(stripAnsi(error.stack!), "/test.ts:2:3");
        assert.include(stripAnsi(error.snippet), "browser.assertView('plane')");
    });
    it("should deduplicate repeated diagnostics", () => {
        const diagnostic = { code: "read-error" as const, file: "/test.js", message: "Cannot read source" };
        const error = new TestPreflightError([diagnostic, diagnostic]);
        assert.lengthOf(error.diagnostics, 1);
        assert.include(error.stack!, "Cannot read source");
    });
});
