import sinon from "sinon";

import { ProfilerPoolObserver } from "src/profiler/collectors/pool-observer";
import type { ProfilerRuntimeLike } from "src/profiler/runtime/types";

describe("profiler/pool-observer", () => {
    it("should record pool spans, current state, peaks and transition totals", () => {
        const span = { end: sinon.spy() };
        const runtime = {
            startSpan: sinon.stub().returns(span),
            sample: sinon.spy(),
            increment: sinon.spy(),
        };
        const observer = new ProfilerPoolObserver(runtime as unknown as ProfilerRuntimeLike);

        observer.start("browser.session.create", { browserId: "chrome" }).end("completed");
        observer.record("queueDepth", { browserId: "chrome", limiter: "browser", value: 2 });
        observer.record("queueDepth", { browserId: "chrome", limiter: "browser", value: 1 });

        assert.calledOnceWith(runtime.startSpan, "browser.session.create", sinon.match({ minLevel: 1 }));
        assert.calledOnceWith(span.end, "completed");
        assert.calledWith(runtime.sample, "browser.pool.queueDepth", 2, {
            browserId: "chrome",
            limiter: "browser",
        });
        assert.calledWith(runtime.sample, "browser.pool.queueDepth.peak", 2, {
            browserId: "chrome",
            limiter: "browser",
        });
        assert.calledWith(runtime.increment, "browser.pool.queueDepth.sampleCount", 1, {
            browserId: "chrome",
            limiter: "browser",
        });

        observer.record("sessionsLaunched", { browserId: "chrome", limiter: "browser", limit: 2, value: 2 });
        assert.calledWith(runtime.increment, "browser.pool.sessionsLaunched.saturatedSampleCount", 1, {
            browserId: "chrome",
            limiter: "browser",
        });
        const saturationCalls = runtime.increment
            .getCalls()
            .filter(call => call.firstArg === "browser.pool.sessionsLaunched.saturatedSampleCount").length;
        observer.record("sessionsLaunched", { browserId: "chrome", limiter: "browser", limit: 2, value: 1 });
        assert.equal(
            runtime.increment
                .getCalls()
                .filter(call => call.firstArg === "browser.pool.sessionsLaunched.saturatedSampleCount").length,
            saturationCalls,
        );
    });

    it("should use counters for discrete pool events", () => {
        const runtime = {
            startSpan: sinon.stub().returns({ end: sinon.spy() }),
            sample: sinon.spy(),
            increment: sinon.spy(),
        };
        const observer = new ProfilerPoolObserver(runtime as unknown as ProfilerRuntimeLike);

        observer.record("sessionReused", { browserId: "chrome" });

        assert.calledOnceWith(runtime.increment, "browser.pool.sessionReused", 1, { browserId: "chrome" });
        assert.notCalled(runtime.sample);
    });
});
