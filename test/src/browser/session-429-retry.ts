import * as http from "node:http";
import { remote } from "@testplane/webdriverio";

const RETRY_BASE_DELAY = 5000;
const RETRY_JITTER = 1000;

describe("session creation 429 retry", () => {
    let server: http.Server;
    let requestTimes: number[];
    let capturedDelays: number[];
    let originalSetTimeout: typeof setTimeout;

    before(done => {
        server = http.createServer((req, res) => {
            if (req.method === "POST") {
                requestTimes.push(Date.now());
            }
            res.writeHead(429, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ value: { error: "session not created", message: "Too Many Requests" } }));
        });
        server.listen(6677, "127.0.0.1", done);
    });

    after(done => server.close(done));

    beforeEach(() => {
        requestTimes = [];
        capturedDelays = [];
        originalSetTimeout = globalThis.setTimeout;

        // Intercept setTimeout: capture backoff delays (>1000ms) and execute them immediately
        // to avoid actually waiting 5s/10s in tests.
        // connectionRetryTimeout must be <1000ms so got's response timeout is NOT captured here.
        (globalThis as unknown as Record<string, unknown>).setTimeout = (
            fn: (...args: unknown[]) => void,
            delay?: number,
            ...args: unknown[]
        ): unknown => {
            if (delay && delay > 1000) {
                capturedDelays.push(delay);
                return originalSetTimeout(fn, 0, ...args);
            }
            return originalSetTimeout(fn, delay, ...args);
        };
    });

    afterEach(() => {
        globalThis.setTimeout = originalSetTimeout;
    });

    it("should retry with exponential backoff delays on 429", async () => {
        const port = (server.address() as { port: number }).port;

        await remote({
            protocol: "http",
            hostname: "127.0.0.1",
            port,
            path: "/",
            capabilities: { browserName: "chrome", "wdio:enforceWebDriverClassic": true },
            connectionRetryCount: 2,
            // Must stay <1000ms so got's response timeout is not captured by our setTimeout interceptor
            connectionRetryTimeout: 900,
            logLevel: "silent",
        }).catch(() => {});

        assert.equal(requestTimes.length, 3, "should make 3 requests total (initial + 2 retries)");
        assert.equal(capturedDelays.length, 2, "should have 2 exponential backoff delays");

        const [delay1, delay2] = capturedDelays;

        // First retry: baseDelay * 2^0 + jitter = 5000..6000ms
        assert.isAtLeast(delay1, RETRY_BASE_DELAY);
        assert.isAtMost(delay1, RETRY_BASE_DELAY + RETRY_JITTER);

        // Second retry: baseDelay * 2^1 + jitter = 10000..11000ms
        assert.isAtLeast(delay2, RETRY_BASE_DELAY * 2);
        assert.isAtMost(delay2, RETRY_BASE_DELAY * 2 + RETRY_JITTER);
    });
});
