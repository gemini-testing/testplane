import {
    ShallowStackFrames,
    applyStackFrames,
    captureRawStackFrames,
    filterExtraWdioFrames,
} from "../../../../src/browser/stacktrace/utils";

type AnyFunc = (...args: any[]) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("utils/stacktrace", () => {
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

    describe("applyStackFrames", () => {
        it("should work with multiline error messages", () => {
            const error = new Error("my\nmulti-line\nerror\nmessage");
            const frames = "foo\nbar";

            applyStackFrames(error, frames);

            const expectedStack = ["Error: my\nmulti-line\nerror\nmessage", "foo", "bar"].join("\n");

            assert.equal(error.stack, expectedStack);
        });

        it("should work with error-like objects", () => {
            const error = { message: "foo" } as Error;
            const frames = "bar";

            applyStackFrames(error, frames);

            const expectedStack = ["Error: foo", "bar"].join("\n");

            assert.equal(error.stack, expectedStack);
        });

        it("should not throw on bad input", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assert.doesNotThrow(() => applyStackFrames("foo" as any, 1 as any));
        });
    });

    describe("filterExtraWdioFrames", () => {
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

            applyStackFrames(error, errorStack);
            filterExtraWdioFrames(error);

            const expectedStack = [
                "Error: my\nmulti-line\nerror\nmessage",
                "at http://localhost:4001/node_modules/webdriverio/build/commands/browser/waitUntil.js?v=80fca7b2:39:23",
                "at async Object.<anonymous> (http://localhost:4001/Users/some-user/foo/project-name/tests-folder/test-name.tsx?import:12:18)",
                "at async Socket.<anonymous> (http://localhost:4001/node_modules/testplane/build/src/runner/browser-env/vite/browser-modules/mocha/index.js?v=80fca7b2:54:17)",
            ].join("\n");

            assert.equal(error.stack, expectedStack);
        });

        it("should not throw on bad input", () => {
            assert.doesNotThrow(() => filterExtraWdioFrames("error-message" as unknown as Error));
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

        describe("isNested", () => {
            it("should return 'false' on different frames", () => {
                const key = stackFrames.getKey();
                const parentFrames = "f\no\no";

                stackFrames.enter(key, parentFrames);

                assert.isFalse(stackFrames.isNested("b\na\nr"));

                stackFrames.leave(key);
            });

            it("should return 'false' on equal frames", () => {
                const key = stackFrames.getKey();
                const parentFrames = "f\no\no";

                stackFrames.enter(key, parentFrames);

                assert.isFalse(stackFrames.isNested("f\no\no"));

                stackFrames.leave(key);
            });

            it("should return 'true' on nested frames", () => {
                const key = stackFrames.getKey();
                const parentFrames = "b\na\nr";

                stackFrames.enter(key, parentFrames);

                assert.isTrue(stackFrames.isNested("f\no\no\nb\na\nr"));

                stackFrames.leave(key);
            });
        });
    });
});
