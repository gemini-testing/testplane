import { assert } from "chai";
import { ExitOnError } from "src/runner/exit-on-error";
import type { Test } from "src/types";

describe("ExitOnError", () => {
    const failure = (message = "quota"): Test => ({ err: new Error(message) }) as Test;

    it("counts each failed attempt once and emits only one fatal error at the limit", () => {
        const checker = new ExitOnError({ limit: 3, patterns: null });
        const test = failure();
        assert.isUndefined(checker.check(test));
        assert.isUndefined(checker.check(test));
        const error = checker.check(test);
        assert.include(error?.message, "limit of 3 errors");
        assert.strictEqual(error?.cause, test.err);
        assert.isUndefined(checker.check(test));
    });

    it("shares a counter across patterns without counting unmatched errors or multiple matches", () => {
        const checker = new ExitOnError({ limit: 3, patterns: [/quota/, /access/] });
        assert.isUndefined(checker.check(failure("quota access")));
        assert.isUndefined(checker.check(failure("assertion failed")));
        assert.isUndefined(checker.check(failure("access")));
        assert.include(checker.check(failure("quota"))?.message, "limit of 3 matching errors");
    });

    it("resets stateful RegExp match positions for each error", () => {
        const checker = new ExitOnError({ limit: 2, patterns: [/quota/gy] });
        assert.isUndefined(checker.check(failure()));
        assert.instanceOf(checker.check(failure()), Error);
    });

    it("ignores missing errors, empty patterns and unlimited configurations", () => {
        assert.isUndefined(new ExitOnError({ limit: 1, patterns: null }).check({} as Test));
        assert.isUndefined(new ExitOnError({ limit: 1, patterns: [] }).check(failure()));
        assert.isUndefined(new ExitOnError().check(failure()));
    });

    it("does not share counters between runner instances", () => {
        const config = { limit: 2, patterns: null };
        const first = new ExitOnError(config);
        first.check(failure());
        first.check(failure());
        const second = new ExitOnError(config);
        assert.isUndefined(second.check(failure()));
        assert.instanceOf(second.check(failure()), Error);
    });
});
