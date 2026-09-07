import { assert } from "chai";
import sinon from "sinon";

import {
    createMochaMiddleware,
    generateTemplate,
} from "../../../../../src/runner/browser-env/vite/plugins/generate-index-html";

import type { WorkerInitializePayload } from "../../../../../src/runner/browser-env/vite/browser-modules/types";
import type { Connect } from "vite";

describe("runner/browser-env/vite/plugins/generate-index-html", () => {
    it("should load runtime modules from Vite root instead of the run UUID route", () => {
        const html = generateTemplate({ file: "/project/test.ts" } as WorkerInitializePayload, "run-id", {
            globals: "/runtime/globals.js",
            browserRunner: "/runtime/browser-runner.js",
        });

        assert.include(html, 'src="/@fs/runtime/globals.js"');
        assert.include(html, '<script src="/__testplane__/mocha.js"></script>');
        assert.include(html, 'src="/@fs/runtime/browser-runner.js"');
        assert.notInclude(html, 'src="@testplane/');
    });

    it("should serve the Mocha browser bundle before Vite fallback", () => {
        const middleware = createMochaMiddleware("window.Mocha = {};");
        const response = { setHeader: sinon.spy(), end: sinon.spy() };
        const next = sinon.spy();

        middleware({ url: "/__testplane__/mocha.js" } as Connect.IncomingMessage, response as never, next);

        sinon.assert.calledOnceWithExactly(response.setHeader, "content-type", "text/javascript; charset=utf-8");
        sinon.assert.calledOnceWithExactly(response.end, "window.Mocha = {};");
        sinon.assert.notCalled(next);
    });

    it("should pass unrelated requests to Vite", () => {
        const next = sinon.spy();

        createMochaMiddleware("")(
            { url: "/test.js" } as Connect.IncomingMessage,
            { setHeader: sinon.spy(), end: sinon.spy() } as never,
            next,
        );

        sinon.assert.calledOnce(next);
    });
});
