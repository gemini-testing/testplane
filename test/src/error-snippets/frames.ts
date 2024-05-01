import sinon, { type SinonStub } from "sinon";
import proxyquire from "proxyquire";
import { resolveLocationWithStackFrame } from "../../../src/error-snippets/frames";
import type { SufficientStackFrame } from "../../../src/error-snippets/types";

describe("error-snippets/frames", () => {
    const sandbox = sinon.createSandbox();

    let logger: { warn: SinonStub };

    describe("findRelevantStackFrame", () => {
        // prettier-ignore
        const frames = {
            browser: {
                wdio: "    at async Element.elementErrorHandlerCallbackFn (http://localhost:4001/node_modules/webdriverio/build/middlewares.js?v=80fca7b2:18:32)",
                unknownWdio: "    at http://localhost:4001/node_modules/webdriverio/build/commands/browser/waitUntil.js?v=80fca7b2:39:23",
                projectDeps: "    at async Socket.<anonymous> (http://localhost:4001/node_modules/testplane/build/src/runner/browser-env/vite/browser-modules/mocha/index.js?v=80fca7b2:54:17)",
                user: "    at async Object.<anonymous> (http://localhost:4001/Users/foo/bar/project/tests-dir/test-name.tsx?import:12:18)",
                repl: "    at <anonymous>:1:5",
            },
            node: {
                wdio: "    at Element.elementErrorHandlerCallbackFn (/Users/foo/bar/project/node_modules/webdriverio/build/middlewares.js?v=80fca7b2:18:32)",
                unknownWdio: "    at file:///Users/foo/bar/project/node_modules/webdriverio/build/commands/browser/waitUntil.js:39:23",
                projectDeps: "    at Object.tryCatcher (/Users/foo/bar/project/node_modules/bluebird/js/release/util.js:16:23)",
                user: "    at Object.<anonymous> (/Users/foo/bar/project/tests-dir/test-name.js:10:23)",
                repl: "    at REPL1:1:1",
                internal1: "    at Module._compile (node:internal/modules/cjs/loader:1159:14)",
                internal2: "    at Script.runInThisContext (node:vm:129:12)",
            },
        } as const;

        let findRelevantStackFrame: (err: Error) => SufficientStackFrame | null;

        const buildError_ = (...errFrames: string[]): Error => {
            if (!errFrames.length) {
                errFrames = [frames.browser.wdio, frames.node.wdio];
            }

            const error = new Error("foo");

            error.stack = `${error.name}: ${error.message}\n${errFrames.join("\n")}`;

            return error;
        };

        beforeEach(() => {
            logger = { warn: sandbox.stub() };
            findRelevantStackFrame = proxyquire("../../../src/error-snippets/frames", {
                "../utils/logger": logger,
            }).findRelevantStackFrame;
        });

        it("should return null without throwing exceptions on bad input", () => {
            const stackFrame = findRelevantStackFrame("foo" as unknown as Error);

            assert.calledOnceWith(logger.warn, "Unable to find relevant stack frame:");
            assert.isNull(stackFrame);
        });

        it("should not return repl frames", () => {
            const error = buildError_(frames.browser.repl, frames.node.repl);

            const stackFrame = findRelevantStackFrame(error);

            console.log(stackFrame);
            assert.notCalled(logger.warn);
            assert.isNull(stackFrame);
        });

        it("should not return internal frames", () => {
            const error = buildError_(frames.node.internal1, frames.node.internal2);

            const stackFrame = findRelevantStackFrame(error);

            assert.notCalled(logger.warn);
            assert.isNull(stackFrame);
        });

        it("should return wdio frame, if there is nothing left", () => {
            const error = buildError_(frames.node.internal1, frames.node.repl, frames.browser.wdio);

            const stackFrame = findRelevantStackFrame(error);

            assert.match(stackFrame, {
                functionName: "async Element.elementErrorHandlerCallbackFn",
                columnNumber: 32,
                lineNumber: 18,
            });
        });

        it("should return first seen frame with equal relevance", () => {
            const error = buildError_(frames.node.internal2, frames.node.repl, frames.node.wdio, frames.browser.wdio);

            const stackFrame = findRelevantStackFrame(error);

            assert.match(stackFrame, {
                functionName: "Element.elementErrorHandlerCallbackFn",
                columnNumber: 32,
                lineNumber: 18,
            });
        });

        it("should rate other project deps frame more, than wdio frame", () => {
            const error = buildError_(frames.browser.wdio, frames.browser.unknownWdio, frames.node.projectDeps);

            const stackFrame = findRelevantStackFrame(error);

            assert.match(stackFrame, {
                functionName: "Object.tryCatcher",
                columnNumber: 23,
                lineNumber: 16,
            });
        });

        it("should value user frame above all for browser", () => {
            const error = buildError_(
                frames.browser.wdio,
                frames.browser.projectDeps,
                frames.browser.repl,
                frames.browser.user,
            );

            const stackFrame = findRelevantStackFrame(error);

            assert.match(stackFrame, {
                functionName: "async Object.<anonymous>",
                columnNumber: 18,
                lineNumber: 12,
            });
        });

        it("should value user frame above all for node", () => {
            const error = buildError_(frames.node.wdio, frames.node.unknownWdio, frames.node.repl, frames.node.user);

            const stackFrame = findRelevantStackFrame(error);

            assert.match(stackFrame, {
                functionName: "Object.<anonymous>",
                columnNumber: 23,
                lineNumber: 10,
            });
        });
    });

    it("resolveLocationWithStackFrame", () => {
        const resolvedFrame = resolveLocationWithStackFrame(
            {
                fileName: "filename",
                lineNumber: 100,
                columnNumber: 500,
            } as SufficientStackFrame,
            "foo",
        );

        assert.deepEqual(resolvedFrame, {
            file: "filename",
            source: "foo",
            location: { line: 100, column: 500 },
        });
    });
});
