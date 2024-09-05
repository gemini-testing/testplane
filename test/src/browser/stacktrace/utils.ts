import {
    ShallowStackFrames,
    applyStackTraceIfBetter,
    captureRawStackFrames,
    filterExtraStackFrames,
} from "../../../../src/browser/stacktrace/utils";

type AnyFunc = (...args: any[]) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("stacktrace/utils", () => {
    describe("captureRawStackFrames", () => {
        it("should only return frames", () => {
            const frames = captureRawStackFrames();
            const framesArr = frames.split("\n");

            assert.isTrue(framesArr.every(frame => /^\s+at.*/.test(frame)));
        });

        it("should return relative to function frames, if function is specified", () => {
            const myFunc1 = (filterFunc?: AnyFunc): string => captureRawStackFrames(filterFunc);
            const myFunc2 = (filterFunc?: AnyFunc): string => myFunc1(filterFunc);
            const myFunc3 = (filterFunc?: AnyFunc): string => myFunc2(filterFunc);

            const checkFramesEquality = (): boolean => {
                return myFunc1(checkFramesEquality) === myFunc3(checkFramesEquality);
            };

            assert.isTrue(checkFramesEquality());
        });
    });

    describe("applyStackTraceIfBetter", () => {
        it("should work with multiline error messages", () => {
            const error = new Error("my\nmulti-line\nerror\nmessage");
            error.stack = "Error: " + error.message + "\n";

            const frames = [
                "at Context.<anonymous> (test/src/browser/stacktrace/utils.ts:43:20)",
                "at processImmediate (node:internal/timers:471:21)",
            ].join("\n");

            applyStackTraceIfBetter(error, frames);

            const expectedStack = [
                "Error: my\nmulti-line\nerror\nmessage",
                "at Context.<anonymous> (test/src/browser/stacktrace/utils.ts:43:20)",
                "at processImmediate (node:internal/timers:471:21)",
            ].join("\n");

            assert.equal(error.stack, expectedStack);
        });

        it("should not throw on bad input", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assert.doesNotThrow(() => applyStackTraceIfBetter("foo" as any, 1 as any));
        });
    });

    describe("filterExtraStackFrames", () => {
        it("should filter out internal wdio frames", () => {
            const error = new Error("my\nmulti-line\nerror\nmessage");
            const errorStack = [
                "at http://localhost:4001/node_modules/webdriverio/build/commands/browser/waitUntil.js?v=80fca7b2:39:23",
                "at async Element.wrapCommandFn (http://localhost:4001/node_modules/webdriverio/node_modules/@wdio/utils/build/shim.js?v=80fca7b2:81:29)",
                "at async Element.elementErrorHandlerCallbackFn (http://localhost:4001/node_modules/webdriverio/build/middlewares.js?v=80fca7b2:18:32)",
                "at Element.wrapCommandFn (http://localhost:4001/node_modules/webdriverio/node_modules/@wdio/utils/build/shim.js?v=80fca7b2:81:29)",
                "at async Element.wrapCommandFn (http://localhost:4001/node_modules/webdriverio/node_modules/@wdio/utils/build/shim.js?v=80fca7b2:81:29)",
                "at async Element.elementErrorHandlerCallbackFn (http://localhost:4001/node_modules/webdriverio/build/middlewares.js?v=80fca7b2:18:32)",
                "at async Element.wrapCommandFn (http://localhost:4001/node_modules/webdriverio/node_modules/@wdio/utils/build/shim.js?v=80fca7b2:81:29)",
                "at async Object.<anonymous> (http://localhost:4001/Users/some-user/foo/project-name/tests-folder/test-name.tsx?import:12:18)",
                "at async Socket.<anonymous> (http://localhost:4001/node_modules/testplane/build/src/runner/browser-env/vite/browser-modules/mocha/index.js?v=80fca7b2:54:17)",
            ].join("\n");

            error.stack = `${error.name}: ${error.message}\n${errorStack}`;
            filterExtraStackFrames(error);

            const expectedStack = [
                "Error: my\nmulti-line\nerror\nmessage",
                "at http://localhost:4001/node_modules/webdriverio/build/commands/browser/waitUntil.js?v=80fca7b2:39:23",
                "at async Object.<anonymous> (http://localhost:4001/Users/some-user/foo/project-name/tests-folder/test-name.tsx?import:12:18)",
                "at async Socket.<anonymous> (http://localhost:4001/node_modules/testplane/build/src/runner/browser-env/vite/browser-modules/mocha/index.js?v=80fca7b2:54:17)",
            ].join("\n");

            assert.equal(error.stack, expectedStack);
        });

        it("should filter out internal testplane frames", () => {
            const error = new Error("my\nmulti-line\nerror\nmessage");
            const errorStack = [
                "at fn (projectDir/node_modules/testplane/src/browser/history/index.js:80:27)",
                "at exports.runWithHooks (projectDir/node_modules/testplane/src/browser/history/utils.js:49:23)",
                "at runWithHistoryHooks (projectDir/node_modules/testplane/src/browser/history/index.js:32:12)",
                "at Browser.decoratedWrapper (projectDir/node_modules/testplane/src/browser/history/index.js:77:20)",
                "at fn (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:53:39)",
                "at exports.runWithHooks (projectDir/node_modules/testplane/src/browser/history/utils.js:49:23)",
                "at runWithStacktraceHooks (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:24:24)",
                "at Browser.decoratedWrapper (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:51:46)",
                "at Object.<anonymous> (projectDir/features/feature/test-name.testplane.js:16:28)",
            ].join("\n");

            error.stack = `${error.name}: ${error.message}\n${errorStack}`;
            filterExtraStackFrames(error);

            const expectedStack = [
                "Error: my\nmulti-line\nerror\nmessage",
                "at Object.<anonymous> (projectDir/features/feature/test-name.testplane.js:16:28)",
            ].join("\n");

            assert.equal(error.stack, expectedStack);
        });

        it("should work with overwritten multiline error message", () => {
            const error = new Error("foo");
            const errorStack = [
                "at fn (projectDir/node_modules/testplane/src/browser/history/index.js:80:27)",
                "at exports.runWithHooks (projectDir/node_modules/testplane/src/browser/history/utils.js:49:23)",
                "at runWithHistoryHooks (projectDir/node_modules/testplane/src/browser/history/index.js:32:12)",
                "at Browser.decoratedWrapper (projectDir/node_modules/testplane/src/browser/history/index.js:77:20)",
                "at fn (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:53:39)",
                "at exports.runWithHooks (projectDir/node_modules/testplane/src/browser/history/utils.js:49:23)",
                "at runWithStacktraceHooks (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:24:24)",
                "at Browser.decoratedWrapper (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:51:46)",
                "at Object.<anonymous> (projectDir/features/feature/test-name.testplane.js:16:28)",
            ].join("\n");

            error.stack = `${error.name}: ${error.message}\n${errorStack}`;
            error.message = "some/\nnew\nerror\nmessage";
            filterExtraStackFrames(error);

            const expectedStack = [
                "Error: some/\nnew\nerror\nmessage",
                "at Object.<anonymous> (projectDir/features/feature/test-name.testplane.js:16:28)",
            ].join("\n");

            assert.equal(error.stack, expectedStack);
        });

        it("should not filter out internal testplane frames if there is no user's code frame", () => {
            const error = new Error("my\nmulti-line\nerror\nmessage");
            const errorStack = [
                "at fn (projectDir/node_modules/testplane/src/browser/history/index.js:80:27)",
                "at exports.runWithHooks (projectDir/node_modules/testplane/src/browser/history/utils.js:49:23)",
                "at runWithHistoryHooks (projectDir/node_modules/testplane/src/browser/history/index.js:32:12)",
                "at Browser.decoratedWrapper (projectDir/node_modules/testplane/src/browser/history/index.js:77:20)",
                "at fn (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:53:39)",
                "at exports.runWithHooks (projectDir/node_modules/testplane/src/browser/history/utils.js:49:23)",
                "at runWithStacktraceHooks (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:24:24)",
                "at Browser.decoratedWrapper (projectDir/node_modules/testplane/src/browser/stacktrace/index.ts:51:46)",
                "at Some.internal (projectDir/node_modules/foo/bar/baz/index.ts:51:46)",
                "at Internal.metod (projectDir/node_modules/qux/index.ts:51:46)",
            ].join("\n");

            error.stack = `${error.name}: ${error.message}\n${errorStack}`;
            filterExtraStackFrames(error);

            const expectedStack = "Error: my\nmulti-line\nerror\nmessage" + "\n" + errorStack;

            assert.equal(error.stack, expectedStack);
        });

        it("should not throw on bad input", () => {
            assert.doesNotThrow(() => filterExtraStackFrames("error-message" as unknown as Error));
        });
    });

    describe("ShallowStackFrames", () => {
        const stackFrames = new ShallowStackFrames();

        describe("getKey", () => {
            it("should give uniq keys", () => {
                const key1 = stackFrames.getKey();
                const key2 = stackFrames.getKey();
                const key3 = stackFrames.getKey();

                assert.notEqual(key1, key2);
                assert.notEqual(key2, key3);
                assert.notEqual(key1, key3);
            });
        });

        describe("areInternal", () => {
            it("should return 'false' on different frames", () => {
                const key = stackFrames.getKey();
                const parentFrames = "f\no\no";

                stackFrames.enter(key, parentFrames);

                assert.isFalse(stackFrames.areInternal("b\na\nr"));

                stackFrames.leave(key);
            });

            it("should return 'false' on equal frames", () => {
                const key = stackFrames.getKey();
                const parentFrames = "f\no\no";

                stackFrames.enter(key, parentFrames);

                assert.isFalse(stackFrames.areInternal("f\no\no"));

                stackFrames.leave(key);
            });

            it("should return 'true' on nested frames if those are internal frames", () => {
                const key = stackFrames.getKey();
                const parentFrames = `b\na\nr`;
                const childFrames = [
                    "at async Element.wrapCommandFn (file:///project_folder/node_modules/webdriverio/node_modules/@wdio/utils/build/shim.js:81:29)",
                    "at processTicksAndRejections (node:internal/process/task_queues:95:5)",
                    "b",
                    "a",
                    "r",
                ].join("\n");

                stackFrames.enter(key, parentFrames);

                assert.isTrue(stackFrames.areInternal(childFrames));

                stackFrames.leave(key);
            });

            it("should return 'false' on nested frames if those are not internal frames", () => {
                const key = stackFrames.getKey();
                const parentFrames = `b\na\nr`;
                const childFrames = ["f", "o", "o", "b", "a", "r"].join("\n");

                stackFrames.enter(key, parentFrames);

                assert.isFalse(stackFrames.areInternal(childFrames));

                stackFrames.leave(key);
            });
        });
    });
});
