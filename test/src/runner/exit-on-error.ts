import { assert } from "chai";
import sinon from "sinon";
import { ExitOnError } from "src/runner/exit-on-error";
import type { ExitOnErrorConfig, ExitOnErrorRule } from "src/config/types";
import type { Test } from "src/types";

describe("ExitOnError", () => {
    const test = (id: string, message = "Too Many Requests", file = "test.js", browserId = "chrome"): Test =>
        ({ id, file, browserId, err: new Error(message) } as Test);
    const create = (filters: ExitOnErrorConfig["filters"], enabled = true): ExitOnError =>
        new ExitOnError({ enabled, filters });

    it("does not call filters when disabled", () => {
        const filter = sinon.spy(() => true);
        const checker = create([{ name: "quota", filter, limit: 1 }], false);

        assert.isUndefined(checker.check(test("one")));
        sinon.assert.notCalled(filter);
    });

    it("passes the error message to a function and stops exactly at the limit", () => {
        const filter = sinon.spy(text => text === "Too Many Requests");
        const checker = create([{ name: "quota", filter, limit: 2 }]);

        assert.isUndefined(checker.check(test("unrelated", "assertion failed")));
        assert.isUndefined(checker.check(test("one")));
        const failedTest = test("two");
        const error = checker.check(failedTest);

        sinon.assert.calledWithExactly(filter, "Too Many Requests");
        assert.include(error?.message, '"quota" reached its limit of 2 matching errors');
        assert.strictEqual(error?.cause, failedTest.err);
        assert.isUndefined(checker.check(test("three")));
        assert.equal(filter.callCount, 3);
    });

    it("counts every failed attempt of the same test", () => {
        const checker = create([{ name: "quota", filter: /Too Many Requests/, limit: 2 }]);
        const failedTest = test("one");

        assert.isUndefined(checker.check(failedTest));
        assert.instanceOf(checker.check(failedTest), Error);
    });

    it("counts the same test separately in different browsers", () => {
        const checker = create([{ name: "quota", filter: /Too Many Requests/, limit: 2 }]);

        assert.isUndefined(checker.check(test("one")));
        assert.instanceOf(checker.check(test("one", "Too Many Requests", "test.js", "firefox")), Error);
    });

    it("keeps independent counters for overlapping named rules across retries", () => {
        const checker = create([
            { name: "quota", filter: /quota/, limit: 4 },
            { name: "access", filter: /access/, limit: 2 },
        ]);

        assert.isUndefined(checker.check(test("one", "quota exceeded")));
        assert.isUndefined(checker.check(test("one", "quota access denied")));
        assert.include(checker.check(test("one", "quota access denied"))?.message, '"access"');
    });

    ["g", "y", "gy", "i"].forEach(flags => {
        it(`matches repeatedly with /${flags} without changing the user's RegExp`, () => {
            const filter = new RegExp("too many requests", flags + (flags.includes("i") ? "" : "i"));
            filter.lastIndex = 7;
            const checker = create([{ name: "quota", filter, limit: 2 }]);

            assert.isUndefined(checker.check(test("one")));
            assert.instanceOf(checker.check(test("two")), Error);
            assert.equal(filter.lastIndex, 7);
        });
    });

    it("turns a filter exception into one named fatal error", () => {
        const cause = new Error("broken filter");
        const filter = sinon.stub().throws(cause);
        const checker = create([{ name: "quota", filter, limit: 1 }]);

        const error = checker.check(test("one"));

        assert.equal(error?.message, 'exitOnError filter "quota" failed');
        assert.strictEqual(error?.cause, cause);
        assert.isUndefined(checker.check(test("two")));
        sinon.assert.calledOnce(filter);
    });

    it("rejects async filters and consumes their rejections", async () => {
        const filter = (async () => {
            throw new Error("async filter");
        }) as unknown as ExitOnErrorRule["filter"];
        const checker = create([{ name: "quota", filter, limit: 1 }]);

        const error = checker.check(test("one"));
        await Promise.resolve();

        assert.equal(error?.message, 'exitOnError filter "quota" failed');
        assert.include((error?.cause as Error).message, "synchronously return a boolean");
    });

    it("starts with fresh counters for each run", () => {
        const config = [{ name: "quota", filter: /Too Many Requests/, limit: 2 }];
        const first = create(config);
        first.check(test("one"));
        first.check(test("two"));

        const second = create(config);

        assert.isUndefined(second.check(test("one")));
        assert.instanceOf(second.check(test("two")), Error);
    });

    it("ignores missing errors and empty rules", () => {
        const filter = sinon.spy(() => true);
        const checker = create([{ name: "quota", filter, limit: 1 }]);

        assert.isUndefined(checker.check({ id: "one" } as Test));
        sinon.assert.notCalled(filter);
        assert.isUndefined(create([]).check(test("one")));
    });
});
