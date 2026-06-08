import proxyquire from "proxyquire";
import RuntimeConfig from "src/config/runtime-config";
import { REPL_INSTRUMENTED_FN_FLAG_KEY } from "src/constants/repl";
import { instrumentReplIfNeeded } from "src/utils/repl-instrumentation";

describe("utils/repl-instrumentation", () => {
    afterEach(() => {
        RuntimeConfig.getInstance().extend({ replMode: undefined });
    });

    it("should inject before-test repl call with visible lexical context", () => {
        RuntimeConfig.getInstance().extend({ replMode: { enabled: true, beforeTest: true } });

        const result = instrumentReplIfNeeded(
            `
                const rootValue = 1000;
                describe("suite", () => {
                    let hookValue = 1;

                    it("should work", async ({ browser, localValue = 234 }) => {
                        await browser.url("about:blank");
                    });
                });
            `,
            "/tmp/sample.testplane.ts",
        );

        assert.include(result, "await browser.switchToRepl({");
        assert.include(result, "get rootValue()");
        assert.include(result, "get hookValue()");
        assert.include(result, "set hookValue");
        assert.include(result, "get localValue()");
        assert.include(result, REPL_INSTRUMENTED_FN_FLAG_KEY);
        assert.match(result, /await browser\.url\("about:blank"\)/);
    });

    it("should not read browser from TDZ if test callback declares local browser", () => {
        RuntimeConfig.getInstance().extend({ replMode: { enabled: true, beforeTest: true } });

        const result = instrumentReplIfNeeded(
            `
                const rootValue = 123;
                it("should work", async function() {
                    const { browser } = this;

                    console.log(rootValue);
                    await browser.url("about:blank");
                });
            `,
            "/tmp/sample.testplane.ts",
        );

        assert.include(result, "await this.browser.switchToRepl({");
        assert.notInclude(result, 'typeof browser !== "undefined"');
    });

    it("should add lexical context to explicit switchToRepl call", () => {
        RuntimeConfig.getInstance().extend({ replMode: { enabled: true, beforeTest: false } });

        const result = instrumentReplIfNeeded(
            `
                const rootValue = 1000;
                it("should work", async ({ browser }) => {
                    const localValue = 234;

                    await browser.switchToRepl({ foo: "bar" });
                });
            `,
            "/tmp/sample.testplane.ts",
        );

        assert.include(result, 'await browser.switchToRepl({ foo: "bar" }, {');
        assert.include(result, "get rootValue()");
        assert.include(result, "get localValue()");
        assert.notInclude(result, REPL_INSTRUMENTED_FN_FLAG_KEY);
    });

    it("should not instrument before-test callback if only repl on fail mode is enabled", () => {
        RuntimeConfig.getInstance().extend({ replMode: { enabled: true, onFail: true } });

        const result = instrumentReplIfNeeded(
            `
                it("should work", async ({ browser }) => {
                    await browser.url("about:blank");
                    throw new Error("boom");
                });
            `,
            "/tmp/sample.testplane.ts",
        );

        assert.notInclude(result, "switchToRepl");
        assert.notInclude(result, REPL_INSTRUMENTED_FN_FLAG_KEY);
    });

    it("should not instrument if repl mode is disabled", () => {
        RuntimeConfig.getInstance().extend({ replMode: { enabled: false, beforeTest: true } });

        const source = `
            it("should work", async ({ browser }) => {
                await browser.switchToRepl();
            });
        `;

        assert.equal(instrumentReplIfNeeded(source, "/tmp/sample.testplane.ts"), source);
    });

    it("should keep original source if typescript is unavailable", () => {
        RuntimeConfig.getInstance().extend({ replMode: { enabled: true, beforeTest: true } });

        const source = `
            it("should work", async ({ browser }) => {
                await browser.url("about:blank");
            });
        `;
        const instrumentation = proxyquire.noCallThru().load("src/utils/repl-instrumentation", {
            typescript: null,
        }) as typeof import("src/utils/repl-instrumentation");

        assert.equal(instrumentation.instrumentReplIfNeeded(source, "/tmp/sample.testplane.ts"), source);
    });
});
