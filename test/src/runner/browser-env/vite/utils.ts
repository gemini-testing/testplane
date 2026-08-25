import { assert } from "chai";

import { WORKER_ENV_BY_RUN_UUID } from "../../../../../src/runner/browser-env/vite/constants";
import { getTestInfoFromViteRequest } from "../../../../../src/runner/browser-env/vite/utils";

import type { Connect } from "vite";
import type { WorkerInitializePayload } from "../../../../../src/runner/browser-env/vite/browser-modules/types";

describe("runner/browser-env/vite/utils", () => {
    afterEach(() => WORKER_ENV_BY_RUN_UUID.clear());

    it("should read a registered worker environment from a run route", () => {
        const environment = {
            file: "/project/test/example.testplane.ts",
        } as WorkerInitializePayload;
        WORKER_ENV_BY_RUN_UUID.set("run-id", environment);

        const result = getTestInfoFromViteRequest(
            request("/run-uuids/run-id/index.html", "/run-uuids/run-id/index.html"),
        );

        assert.equal(result?.routeName, "run-uuids");
        assert.equal(result?.runUuid, "run-id");
        assert.match(result?.env.file ?? "", /test\/example\.testplane\.ts$/);
    });

    it("should ignore dependency index files outside the run route", () => {
        const dependency = "/run-uuids/@testplane/webdriver/build/index.html";

        assert.isNull(getTestInfoFromViteRequest(request(dependency, dependency)));
    });

    it("should fail when a run route references an unknown worker", () => {
        assert.throws(
            () => getTestInfoFromViteRequest(request("/run-uuids/unknown/index.html", "/run-uuids/unknown/index.html")),
            /Worker environment is not found by "unknown"/,
        );
    });
});

function request(url: string, originalUrl: string): Connect.IncomingMessage {
    return { url, originalUrl } as Connect.IncomingMessage;
}
