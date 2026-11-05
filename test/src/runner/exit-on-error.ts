import { assert } from "chai";
import sinon from "sinon";
import { ExitOnError } from "src/runner/exit-on-error";
import type { ErrorPatterns, ErrorPattern } from "src/config/types";
import type { Test } from "src/types";

describe("ExitOnError", () => {
    const test = (id: string, message = "Too Many Requests", file = "test.js", browserId = "chrome"): Test =>
        ({ id, file, browserId, err: new Error(message) } as Test);
    const create = (patterns: ErrorPatterns, limit = 1): ExitOnError =>
        new ExitOnError({ maxFailures: { limit, patterns }, patternsOnReject: [] });

    it("does not stop by default", () => {
        const checker = new ExitOnError({ maxFailures: Infinity, patternsOnReject: [] });
        assert.isUndefined(checker.check(test("one")));
        assert.isUndefined(checker.check(test("two")));
    });

    it("counts any errors when maxFailures is a number", () => {
        const checker = new ExitOnError({ maxFailures: 3, patternsOnReject: [] });
        assert.isUndefined(checker.check(test("one", "assertion failed")));
        assert.isUndefined(checker.check(test("one", "timeout")));
        const failedTest = test("two", "access denied", "test.js", "firefox");
        const error = checker.check(failedTest);
        assert.include(error?.message, "system.maxFailures reached its limit of 3 errors");
        assert.strictEqual(error?.cause, failedTest.err);
        assert.isUndefined(checker.check(test("three")));
    });

    [Infinity, 20, { limit: 20, patterns: [{ name: "quota", pattern: /Too Many Requests/ }] }].forEach(maxFailures => {
        it(`stops immediately on patternsOnReject with maxFailures ${JSON.stringify(maxFailures)}`, () => {
            const checker = new ExitOnError({
                maxFailures,
                patternsOnReject: [{ name: "quota", pattern: /Too Many Requests/ }],
            });
            assert.isUndefined(checker.check(test("one", "assertion failed")));
            const failedTest = test("two");
            const error = checker.check(failedTest);
            assert.include(error?.message, 'system.patternsOnReject matched pattern "quota"');
            assert.strictEqual(error?.cause, failedTest.err);
            assert.isUndefined(checker.check(test("three")));
        });
    });

    it("can reuse the same patterns in both options without modifying them", () => {
        const pattern = /Too Many Requests/g;
        pattern.lastIndex = 7;
        const patterns = [{ name: "quota", pattern }];
        const checker = new ExitOnError({ maxFailures: { limit: 20, patterns }, patternsOnReject: patterns });
        assert.include(checker.check(test("one"))?.message, "system.patternsOnReject");
        assert.equal(pattern.lastIndex, 7);
    });

    it("supports legacy string and RegExp patterns in both options", () => {
        const checker = new ExitOnError({
            maxFailures: { limit: 2, patterns: ["quota", /access/] },
            patternsOnReject: ["fatal"],
        });
        assert.isUndefined(checker.check(test("one", "quota")));
        assert.include(checker.check(test("two", "access"))?.message, "limit of 2 matching errors");
        const reject = new ExitOnError({ maxFailures: Infinity, patternsOnReject: [/fatal/g] });
        assert.include(reject.check(test("one", "fatal"))?.message, "system.patternsOnReject");
    });

    it("turns a patternsOnReject exception into one fatal error", () => {
        const cause = new Error("broken pattern");
        const pattern = sinon.stub().throws(cause);
        const checker = new ExitOnError({ maxFailures: Infinity, patternsOnReject: [{ name: "quota", pattern }] });
        const error = checker.check(test("one"));
        assert.equal(error?.message, 'system.patternsOnReject pattern "quota" failed');
        assert.strictEqual(error?.cause, cause);
        assert.isUndefined(checker.check(test("two")));
        sinon.assert.calledOnce(pattern);
    });

    it("passes the error message to a function and stops exactly at the limit", () => {
        const pattern = sinon.spy(text => text === "Too Many Requests");
        const checker = create([{ name: "quota", pattern }], 2);

        assert.isUndefined(checker.check(test("unrelated", "assertion failed")));
        assert.isUndefined(checker.check(test("one")));
        const failedTest = test("two");
        const error = checker.check(failedTest);

        sinon.assert.calledWithExactly(pattern, "Too Many Requests");
        assert.include(error?.message, 'reached its limit of 2 matching errors (pattern "quota")');
        assert.strictEqual(error?.cause, failedTest.err);
        assert.isUndefined(checker.check(test("three")));
        assert.equal(pattern.callCount, 3);
    });

    it("counts every failed attempt of the same test", () => {
        const checker = create([{ name: "quota", pattern: /Too Many Requests/ }], 2);
        const failedTest = test("one");

        assert.isUndefined(checker.check(failedTest));
        assert.instanceOf(checker.check(failedTest), Error);
    });

    it("counts the same test separately in different browsers", () => {
        const checker = create([{ name: "quota", pattern: /Too Many Requests/ }], 2);

        assert.isUndefined(checker.check(test("one")));
        assert.instanceOf(checker.check(test("one", "Too Many Requests", "test.js", "firefox")), Error);
    });

    it("shares a counter across different patterns and ignores unrelated errors", () => {
        const checker = create(
            [
                { name: "quota", pattern: /quota/ },
                { name: "access", pattern: /access/ },
            ],
            3,
        );

        assert.isUndefined(checker.check(test("one", "quota exceeded")));
        assert.isUndefined(checker.check(test("two", "assertion failed")));
        assert.isUndefined(checker.check(test("three", "access denied")));
        assert.include(checker.check(test("four", "quota exceeded"))?.message, "limit of 3 matching errors");
    });

    it("counts an error matching multiple patterns only once", () => {
        const checker = create(
            [
                { name: "quota", pattern: /quota/ },
                { name: "access", pattern: /access/ },
            ],
            3,
        );

        assert.isUndefined(checker.check(test("one", "quota access denied")));
        assert.isUndefined(checker.check(test("one", "quota access denied")));
        assert.instanceOf(checker.check(test("one", "quota access denied")), Error);
    });

    ["g", "y", "gy", "i"].forEach(flags => {
        it(`matches repeatedly with /${flags} without changing the user's RegExp`, () => {
            const pattern = new RegExp("too many requests", flags + (flags.includes("i") ? "" : "i"));
            pattern.lastIndex = 7;
            const checker = create([{ name: "quota", pattern }], 2);

            assert.isUndefined(checker.check(test("one")));
            assert.instanceOf(checker.check(test("two")), Error);
            assert.equal(pattern.lastIndex, 7);
        });
    });

    it("turns a pattern exception into one named fatal error", () => {
        const cause = new Error("broken pattern");
        const pattern = sinon.stub().throws(cause);
        const checker = create([{ name: "quota", pattern }], 1);

        const error = checker.check(test("one"));

        assert.equal(error?.message, 'system.maxFailures pattern "quota" failed');
        assert.strictEqual(error?.cause, cause);
        assert.isUndefined(checker.check(test("two")));
        sinon.assert.calledOnce(pattern);
    });

    it("rejects async patterns and consumes their rejections", async () => {
        const pattern = (async () => {
            throw new Error("async pattern");
        }) as unknown as ErrorPattern["pattern"];
        const checker = create([{ name: "quota", pattern }], 1);

        const error = checker.check(test("one"));
        await Promise.resolve();

        assert.equal(error?.message, 'system.maxFailures pattern "quota" failed');
        assert.include((error?.cause as Error).message, "synchronously return a boolean");
    });

    it("starts with a fresh counter for each run", () => {
        const config = [{ name: "quota", pattern: /Too Many Requests/ }];
        const first = create(config, 2);
        first.check(test("one"));
        first.check(test("two"));

        const second = create(config, 2);

        assert.isUndefined(second.check(test("one")));
        assert.instanceOf(second.check(test("two")), Error);
    });

    it("ignores missing errors and empty rules", () => {
        const pattern = sinon.spy(() => true);
        const checker = create([{ name: "quota", pattern }], 1);

        assert.isUndefined(checker.check({ id: "one" } as Test));
        sinon.assert.notCalled(pattern);
        assert.isUndefined(create([]).check(test("one")));
    });
});
