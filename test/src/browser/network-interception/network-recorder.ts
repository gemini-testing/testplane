import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import sinon from "sinon";
import proxyquire from "proxyquire";
import type {
    NetworkEventSourceHandlers,
    NetworkRequest,
    NetworkResponse,
} from "src/browser/network-interception/types";

class Monitor {
    handlers!: NetworkEventSourceHandlers;
    start = sinon.stub().callsFake(async (handlers: NetworkEventSourceHandlers) => {
        this.handlers = handlers;
    });
    stop = sinon.stub().resolves();
    reconcile = sinon.stub();
    [Symbol.asyncDispose] = (): Promise<void> => this.stop();
}

const request = (body: Buffer | null = null): NetworkRequest => ({
    url: "https://example.com/api",
    method: "POST",
    headers: [],
    timestamp: 100,
    consumeBody: async () => body,
});
const response = (request: NetworkRequest, body: Buffer): NetworkResponse => ({
    request,
    status: 200,
    statusText: "OK",
    headers: [],
    timestamp: 110,
    consumeBody: async () => body,
});

describe("Time Travel network recorder", () => {
    const sandbox = sinon.createSandbox();
    const settings = { maxBodySizeBytes: 1024 };
    // eslint-disable-next-line camelcase
    const session = { unstable_getCdp: async () => ({}) } as never;
    let dir: string;
    let monitor: Monitor;
    let recorderModule: typeof import("src/browser/network-interception/network-recorder");

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), "network-recorder-"));
        monitor = new Monitor();
        recorderModule = proxyquire("src/browser/network-interception/network-recorder", {
            "./cdp-network-event-source": { CdpNetworkEventSource: sinon.stub().returns(monitor) },
            "../../temp": { attach: () => {}, init: () => {}, path: () => path.join(dir, crypto.randomUUID()) },
        });
    });

    afterEach(async () => {
        sandbox.restore();
        await fs.remove(dir);
    });

    it("should save binary bodies once when a response echoes the request", async () => {
        const body = Buffer.from([0, 128, 255]);
        const req = request(body);
        await using recorder = await recorderModule.NetworkRecorder.start(session, settings);

        monitor.handlers.onRequest(req);
        const timing = { startTime: 100, sendStart: 0, sendEnd: 1, responseHeadersEnd: 10 };
        monitor.handlers.onResponse({ ...response(req, body), timing });
        monitor.handlers.onFinished(req, 120);
        await recorder.stop();
        const [saved] = recorder.snapshot();

        assert.include(saved, { url: req.url, method: "POST", finishedAt: 120 });
        assert.include(saved.response, { status: 200, bodyHash: saved.bodyHash, bodyFilePath: saved.bodyFilePath });
        assert.deepEqual(saved.response?.timing, timing);
        assert.equal(saved.bodyHash, crypto.createHash("sha256").update(body).digest("hex"));
        assert.deepEqual(await fs.readFile(saved.bodyFilePath!), body);
        assert.lengthOf(await fs.readdir(dir), 1);
    });

    it("should refresh headers and network status when taking a live snapshot", async () => {
        const req = { ...request(), resourceType: undefined as string | undefined };
        const res = { ...response(req, Buffer.alloc(0)), networkStatus: undefined as number | undefined };
        await using recorder = await recorderModule.NetworkRecorder.start(session, settings);
        monitor.handlers.onRequest(req);
        monitor.handlers.onResponse(res);
        monitor.handlers.onFinished(req, 120);
        const [initial] = recorder.snapshot();
        monitor.reconcile.callsFake(() => {
            req.headers = [{ name: "cookie", value: "proof" }];
            req.resourceType = "fetch";
            res.headers = [{ name: "set-cookie", value: "proof" }];
            res.networkStatus = 304;
        });

        const [saved] = recorder.snapshot();

        assert.notProperty(initial, "resourceType");
        assert.equal(saved.resourceType, "fetch");
        assert.isEmpty(initial.headers);
        assert.isEmpty(initial.response!.headers);
        assert.notProperty(initial.response!, "timing");
        assert.isUndefined(initial.response!.networkStatus);
        assert.notCalled(monitor.stop);
        assert.deepEqual(saved.headers, req.headers);
        assert.deepEqual(saved.response!.headers, res.headers);
        assert.equal(saved.response!.status, 200);
        assert.equal(saved.response!.networkStatus, 304);
    });

    it("should record write errors without publishing body references or retrying duplicate bodies", async () => {
        const write = sandbox.stub(fs, "writeFile").rejects(new Error("disk unavailable"));
        const body = Buffer.from("proof");
        await using recorder = await recorderModule.NetworkRecorder.start(session, settings);
        monitor.handlers.onRequest(request(body));
        await new Promise(resolve => setImmediate(resolve));
        monitor.handlers.onRequest(request(body));

        await recorder.stop();
        const saved = recorder.snapshot();

        for (const record of saved) {
            assert.equal(record.bodyError, "disk unavailable");
            assert.notProperty(record, "bodyHash");
            assert.notProperty(record, "bodyFilePath");
        }
        assert.calledOnce(write);
    });

    it("should preserve failed and unfinished requests", async () => {
        const failed = request();
        const pending = { ...request(), url: "https://example.com/pending" };
        await using recorder = await recorderModule.NetworkRecorder.start(session, settings);

        monitor.handlers.onRequest(failed);
        monitor.handlers.onFailed(failed, 120, "net::ERR_FAILED");
        monitor.handlers.onRequest(pending);
        await recorder.stop();
        const saved = recorder.snapshot();

        assert.deepEqual(saved, [
            {
                url: failed.url,
                method: "POST",
                headers: [],
                timestamp: 100,
                finishedAt: 120,
                failure: "net::ERR_FAILED",
            },
            { url: pending.url, method: "POST", headers: [], timestamp: 100 },
        ]);
    });

    it("should keep metadata when bodies exceed the limit or cannot be read", async () => {
        const req = request(Buffer.from("four"));
        await using recorder = await recorderModule.NetworkRecorder.start(session, { maxBodySizeBytes: 3 });
        const res = {
            ...response(req, Buffer.alloc(0)),
            consumeBody: async (): Promise<Buffer> => {
                throw new Error("body evicted");
            },
        };

        monitor.handlers.onRequest(req);
        monitor.handlers.onResponse(res);
        await recorder.stop();
        const [saved] = recorder.snapshot();

        assert.include(saved, { url: req.url, bodyError: "Body exceeds 3 bytes" });
        assert.include(saved.response, { status: 200, bodyError: "body evicted" });
        assert.isEmpty(await fs.readdir(dir));
    });

    it("should return an empty recording when CDP is unavailable", async () => {
        // eslint-disable-next-line camelcase
        const session = { unstable_getCdp: async () => null } as never;

        await using recorder = await recorderModule.NetworkRecorder.start(session, settings);
        assert.isEmpty(recorder.snapshot());
        assert.notCalled(monitor.start);
    });

    it("should flush the monitor before returning the final response body", async () => {
        const req = request();
        let finishBody!: (body: Buffer) => void;
        const body = new Promise<Buffer>(resolve => {
            finishBody = resolve;
        });
        monitor.start.callsFake(async (handlers: NetworkEventSourceHandlers) => {
            monitor.handlers = handlers;
            monitor.handlers.onRequest(req);
            monitor.handlers.onResponse({ ...response(req, Buffer.alloc(0)), consumeBody: () => body });
        });
        monitor.stop.callsFake(async () => {
            monitor.handlers.onFinished(req, 120);
            finishBody(Buffer.from("last response"));
        });

        {
            await using recording = await recorderModule.NetworkRecorder.start(session, settings);
            await recording.stop();
            const [saved] = recording.snapshot();

            assert.equal(saved.finishedAt, 120);
            assert.deepEqual(await fs.readFile(saved.response!.bodyFilePath!), Buffer.from("last response"));
        }
        assert.calledOnce(monitor.stop);
    });
});
