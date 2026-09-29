import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import sinon from "sinon";
import proxyquire from "proxyquire";
import { TimeTravelMode } from "src/config";
import { CdpNetworkMonitor } from "src/browser/network-interception/cdp-network-monitor";
import type { NetworkMonitorEvents, NetworkRequest, NetworkResponse } from "src/browser/network-interception/types";

class Monitor extends EventEmitter<NetworkMonitorEvents> {
    start = sinon.stub().resolves();
    stop = sinon.stub().resolves();
}

const request = (body: Buffer | null = null): NetworkRequest => ({
    url: "https://example.com/api",
    method: "POST",
    headers: [],
    timestamp: 100,
    body: async () => body,
});
const response = (request: NetworkRequest, body: Buffer): NetworkResponse => ({
    request,
    status: 200,
    statusText: "OK",
    headers: [],
    timestamp: 110,
    body: async () => body,
});

describe("Time Travel network recorder", () => {
    const sandbox = sinon.createSandbox();
    const config = { mode: TimeTravelMode.On, network: { enabled: true, maxBodySizeBytes: 1024 } };
    let dir: string;
    let monitor: Monitor;
    let recorderModule: typeof import("src/browser/network-interception/network-recorder");

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), "network-recorder-"));
        monitor = new Monitor();
        recorderModule = proxyquire("src/browser/network-interception/network-recorder", {
            "../../temp": { attach: () => {}, path: () => path.join(dir, crypto.randomUUID()) },
        });
    });

    afterEach(async () => {
        sandbox.restore();
        await fs.remove(dir);
    });

    it("should save binary bodies once when a response echoes the request", async () => {
        const body = Buffer.from([0, 128, 255]);
        const req = request(body);
        const recorder = new recorderModule.NetworkRecorder(monitor, 1024);

        monitor.emit("request", req);
        monitor.emit("response", response(req, body));
        monitor.emit("requestfinished", req, 120);
        const [saved] = await recorder.stop();

        assert.include(saved, { url: req.url, method: "POST", finishedAt: 120 });
        assert.include(saved.response, { status: 200, bodyHash: saved.bodyHash, bodyFilePath: saved.bodyFilePath });
        assert.equal(saved.bodyHash, crypto.createHash("sha256").update(body).digest("hex"));
        assert.deepEqual(await fs.readFile(saved.bodyFilePath!), body);
        assert.lengthOf(await fs.readdir(dir), 1);
    });

    it("should preserve failed and unfinished requests", async () => {
        const failed = request();
        const pending = { ...request(), url: "https://example.com/pending" };
        const recorder = new recorderModule.NetworkRecorder(monitor, 1024);

        monitor.emit("request", failed);
        monitor.emit("requestfailed", failed, 120, "net::ERR_FAILED");
        monitor.emit("request", pending);
        const saved = await recorder.stop();

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
        const recorder = new recorderModule.NetworkRecorder(monitor, 3);
        const res = {
            ...response(req, Buffer.alloc(0)),
            body: async (): Promise<Buffer> => {
                throw new Error("body evicted");
            },
        };

        monitor.emit("request", req);
        monitor.emit("response", res);
        const [saved] = await recorder.stop();

        assert.include(saved, { url: req.url, bodyError: "Body exceeds 3 bytes" });
        assert.include(saved.response, { status: 200, bodyError: "body evicted" });
        assert.isEmpty(await fs.readdir(dir));
    });

    it("should unsubscribe only its own listeners when stopped", async () => {
        const listener = sandbox.spy();
        monitor.on("request", listener);
        const recorder = new recorderModule.NetworkRecorder(monitor, 1024);

        const saved = await recorder.stop();
        monitor.emit("request", request());

        assert.isEmpty(saved);
        assert.calledOnce(listener);
        assert.notCalled(monitor.stop);
        assert.deepEqual(monitor.eventNames(), ["request"]);
    });

    it("should avoid CDP unless network recording is enabled for this attempt", async () => {
        const getCdp = sandbox.stub().rejects(new Error("CDP must not be accessed"));
        // eslint-disable-next-line camelcase
        const session = { unstable_getCdp: getCdp } as never;
        const disabledConfigs = [
            { ...config, network: { ...config.network, enabled: false } },
            { ...config, mode: TimeTravelMode.Off },
            { ...config, mode: TimeTravelMode.RetriesOnly },
        ];

        const recordings = await Promise.all(
            disabledConfigs.map(options => recorderModule.startNetworkRecording(session, options, false)),
        );

        assert.deepEqual(recordings, [null, null, null]);
        assert.notCalled(getCdp);
    });

    it("should warn once per unsupported browser session", async () => {
        const warn = sandbox.stub(console, "warn");
        // eslint-disable-next-line camelcase
        const session = { sessionId: crypto.randomUUID(), unstable_getCdp: async () => null } as never;

        const first = await recorderModule.startNetworkRecording(session, config, false);
        const second = await recorderModule.startNetworkRecording(session, config, false);

        assert.deepEqual([first, second], [null, null]);
        assert.calledOnceWithMatch(warn, sinon.match.string, /CDP is unavailable/);
    });

    it("should flush the monitor before returning the final response body", async () => {
        const req = request();
        let finishBody!: (body: Buffer) => void;
        const body = new Promise<Buffer>(resolve => {
            finishBody = resolve;
        });
        sandbox.stub(CdpNetworkMonitor.prototype, "start").callsFake(async function (this: CdpNetworkMonitor) {
            this.emit("request", req);
            this.emit("response", { ...response(req, Buffer.alloc(0)), body: () => body });
        });
        sandbox.stub(CdpNetworkMonitor.prototype, "stop").callsFake(async function (this: CdpNetworkMonitor) {
            this.emit("requestfinished", req, 120);
            finishBody(Buffer.from("last response"));
        });
        // eslint-disable-next-line camelcase
        const session = { unstable_getCdp: async () => ({}) } as never;

        const recording = await recorderModule.startNetworkRecording(session, config, false);
        const [saved] = await recording!.stop();

        assert.equal(saved.finishedAt, 120);
        assert.deepEqual(await fs.readFile(saved.response!.bodyFilePath!), Buffer.from("last response"));
    });
});
