import sinon from "sinon";

import type { ProfilerClock } from "src/profiler/runtime/clock";
import { noopProfilerRuntime } from "src/profiler/runtime/noop";
import { ProfilerRuntime } from "src/profiler/runtime/runtime";
import { RETENTION_POLICY_V1 } from "src/profiler/retention/policy-v1";

describe("profiler/runtime", () => {
    const createClock = (): ProfilerClock & {
        advance(milliseconds: number): void;
    } => {
        let now = 0;
        const usage = (): NodeJS.CpuUsage => ({ user: now * 1000, system: 0 });

        return {
            now: () => now,
            epochNow: () => 1_700_000_000_000 + now,
            cpuUsage: (previous?: NodeJS.CpuUsage): NodeJS.CpuUsage => {
                const current = usage();
                return previous
                    ? {
                          user: current.user - previous.user,
                          system: current.system - previous.system,
                      }
                    : current;
            },
            threadCpuUsage: (previous?: NodeJS.CpuUsage): NodeJS.CpuUsage => {
                const current = usage();
                return previous
                    ? {
                          user: current.user - previous.user,
                          system: current.system - previous.system,
                      }
                    : current;
            },
            advance: (milliseconds: number): void => {
                now += milliseconds;
            },
        };
    };

    it("should record nested spans and close a span idempotently", () => {
        const clock = createClock();
        const runtime = new ProfilerRuntime({ runId: "run", level: 3, clock });

        runtime.withSpan("parent", { name: "parent" }, () => {
            clock.advance(10);
            const child = runtime.startSpan("child", { name: "child" });
            clock.advance(20);
            child.end();
            child.end("failed");
            clock.advance(5);
        });
        runtime.stop();

        const snapshot = runtime.snapshot();
        const parent = snapshot.operations.find(operation => operation.kind === "parent");
        const child = snapshot.operations.find(operation => operation.kind === "child");

        assert.equal(parent!.timing.wallMs, 35);
        assert.equal(child!.timing.wallMs, 20);
        assert.equal(child!.parentId, parent!.id);
        assert.equal(child!.status, "completed");
    });

    it("should preserve sync and async action results and errors", async () => {
        const clock = createClock();
        const runtime = new ProfilerRuntime({ runId: "run", level: 1, clock });
        const expectedError = new Error("boom");

        assert.equal(
            runtime.withSpan("sync", {}, () => 42),
            42,
        );
        assert.equal(await runtime.withSpan("async", {}, async () => "value"), "value");
        assert.throws(
            () =>
                runtime.withSpan("failed", {}, () => {
                    throw expectedError;
                }),
            expectedError,
        );
        runtime.stop();

        assert.equal(runtime.snapshot().operations.find(operation => operation.kind === "failed")!.status, "failed");
    });

    it("should retain bounded details without changing full aggregates", () => {
        const clock = createClock();
        const runtime = new ProfilerRuntime({ runId: "run", level: 2, clock });
        const listenerLimit = RETENTION_POLICY_V1.operationLimits["event.listener"];
        const listenerCount = listenerLimit + 50;

        for (let index = 0; index < listenerCount; index += 1) {
            const span = runtime.startSpan("event.listener", { name: "listener" });
            clock.advance(index + 1);
            span.end();
        }
        runtime.stop();

        const snapshot = runtime.snapshot();
        const aggregate = snapshot.aggregates.find(item => item.kind === "event.listener");
        const truncation = snapshot.truncation.find(item => item.collector === "event.listener");

        assert.equal(aggregate!.statistics.count, listenerCount);
        assert.lengthOf(
            snapshot.operations.filter(operation => operation.kind === "event.listener"),
            listenerLimit,
        );
        assert.deepInclude(truncation, {
            seen: listenerCount,
            retained: listenerLimit,
            truncated: true,
        });
    });

    it("should account nested browser commands as root wall and cumulative work separately", () => {
        const clock = createClock();
        const runtime = new ProfilerRuntime({ runId: "run", level: 3, clock });

        runtime.withSpan("test.body", {}, () => {
            runtime.withSpan("browser.command", { name: "outer" }, () => {
                clock.advance(3);
                runtime.withSpan("browser.command", { name: "inner" }, () => clock.advance(7));
                clock.advance(2);
            });
        });
        runtime.stop();

        const snapshot = runtime.snapshot();
        const root = snapshot.aggregates.find(item => item.kind === "browser.command.root");
        const cumulative = snapshot.aggregates.find(item => item.kind === "browser.command.cumulative");

        assert.deepInclude(root!.statistics, { count: 1, sum: 12 });
        assert.deepInclude(cumulative!.statistics, { count: 2, sum: 19 });
    });

    it("should execute the strict no-op path without producing a snapshot", () => {
        const action = sinon.spy(() => "result");

        assert.equal(noopProfilerRuntime.withSpan("ignored", {}, action), "result");
        assert.isFalse(noopProfilerRuntime.isEnabled());
        assert.isNull(noopProfilerRuntime.snapshot());
        assert.calledOnce(action);
    });

    it("should keep an exact bounded summary of test-file load durations", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
            process: { type: "master", pid: 1 },
        });

        runtime.recordMeasurement("test.file.load", 10, {
            name: "first.testplane.ts",
        });
        runtime.recordMeasurement("test.file.load", 30, {
            name: "second.testplane.ts",
        });
        runtime.stop();

        const summary = runtime.snapshot().aggregates.find(item => item.kind === "test.file.load.summary");
        assert.equal(summary!.name, "master");
        assert.deepEqual(summary!.attributes, { process: "master" });
        assert.deepInclude(summary!.statistics, {
            count: 2,
            sum: 40,
            mean: 20,
            max: 30,
        });

        const worker = new ProfilerRuntime({
            runId: "worker-run",
            level: 2,
            clock: createClock(),
            process: { type: "worker", pid: 2 },
        });
        worker.recordMeasurement("test.file.load", 20, {
            name: "worker.testplane.ts",
        });
        worker.stop();

        assert.notExists(worker.snapshot().aggregates.find(item => item.kind === "test.file.load.summary"));
    });

    it("should close interrupted spans child-first so retained children keep their parents", () => {
        const clock = createClock();
        const runtime = new ProfilerRuntime({ runId: "run", level: 2, clock });
        const attemptLimit = RETENTION_POLICY_V1.operationLimits["test.attempt"];
        for (let index = 0; index < attemptLimit; index += 1) {
            runtime.recordMeasurement("test.attempt", 100 + index, {
                name: `winner-${index}`,
            });
        }

        const parent = runtime.startSpan("test.attempt", {
            name: "interrupted-parent",
        });
        clock.advance(1);
        const child = runtime.startSpan("browser.session.acquire", {
            name: "interrupted-child",
            parentId: parent.id,
        });
        clock.advance(1);
        runtime.stop();

        const byId = new Map(runtime.snapshot().operations.map(operation => [operation.id, operation]));
        assert.isTrue(byId.has(parent.id!));
        assert.isTrue(byId.has(child.id!));
        assert.equal(byId.get(child.id!)!.parentId, parent.id);
        assert.equal(byId.get(parent.id!)!.status, "interrupted");
        assert.equal(byId.get(child.id!)!.status, "interrupted");
    });

    it("should preserve the interrupted child union when a later sibling finishes first", () => {
        const clock = createClock();
        const runtime = new ProfilerRuntime({ runId: "run", level: 2, clock });
        const parent = runtime.startSpan("parent");
        clock.advance(1);
        runtime.startSpan("child", { parentId: parent.id });
        clock.advance(3);
        const later = runtime.startSpan("child", { parentId: parent.id });
        clock.advance(2);
        later.end();
        clock.advance(4);

        runtime.stop();

        const operation = runtime.snapshot().operations.find(item => item.id === parent.id);
        assert.equal(operation!.timing.observedChildUnionMs, 9);
    });

    it("should retain only open child intervals while an earlier sibling is running", () => {
        const clock = createClock();
        const runtime = new ProfilerRuntime({ runId: "run", level: 2, clock });
        const parent = runtime.startSpan("parent");
        runtime.startSpan("child", { parentId: parent.id });
        for (let index = 0; index < 20_000; index += 1) {
            clock.advance(1);
            const sibling = runtime.startSpan("child", { parentId: parent.id });
            clock.advance(1);
            sibling.end();
        }
        type LinkedSpan = { nextSibling?: LinkedSpan };
        const parentSpan = (
            runtime as unknown as {
                _openSpans: Map<string, { childIntervalHead?: LinkedSpan }>;
            }
        )._openSpans.get(parent.id!)!;
        let retained = 0;
        let child = parentSpan.childIntervalHead;
        while (child) {
            retained += 1;
            child = child.nextSibling;
        }

        runtime.stop();

        assert.equal(retained, 1);
        const operation = runtime.snapshot().operations.find(item => item.id === parent.id);
        assert.equal(operation!.timing.observedChildUnionMs, operation!.timing.wallMs);
    });

    it("should close deeply nested open spans without overflowing the call stack", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        let parentId: string | undefined;
        for (let index = 0; index < 5_000; index += 1) {
            parentId = runtime.startSpan("nested", { parentId }).id;
        }

        assert.doesNotThrow(() => runtime.stop());
    });

    it("should retain browser process attribution for external measurements", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 3,
            clock: createClock(),
        });
        runtime.recordMeasurement("browser.runnable", 25, {
            minLevel: 3,
            process: { type: "browser", browserId: "chrome" },
            context: { browserId: "chrome" },
        });
        runtime.stop();

        const operation = runtime.snapshot().operations.find(item => item.kind === "browser.runnable");
        assert.deepEqual(operation!.process, {
            type: "browser",
            browserId: "chrome",
        });
        assert.equal(operation!.timing.wallMs, 25);
    });

    it("should separate async wall time into active JS and waiting time at level 3", async () => {
        const runtime = new ProfilerRuntime({ runId: "run", level: 3 });

        await runtime.withSpan("async-operation", {}, async () => {
            await new Promise(resolve => setTimeout(resolve, 15));
            let total = 0;
            for (let index = 0; index < 10_000; index += 1) {
                total += Math.sqrt(index);
            }
            assert.isAbove(total, 0);
        });
        runtime.stop();

        const operation = runtime.snapshot().operations.find(item => item.kind === "async-operation");
        assert.isNumber(operation!.timing.activeJsMs);
        assert.isAtLeast(operation!.timing.waitingMs!, 5);
        assert.isAtMost(operation!.timing.activeJsMs!, operation!.timing.wallMs);
    });

    it("should bound high-cardinality aggregates and report the overflow", () => {
        const clock = createClock();
        const runtime = new ProfilerRuntime({ runId: "run", level: 2, clock });

        for (let index = 0; index < 5_100; index += 1) {
            runtime.recordMeasurement("test.attempt", 1, { name: `test-${index}` });
        }
        runtime.stop();

        const snapshot = runtime.snapshot();
        const truncation = snapshot.truncation.find(item => item.collector === "aggregate-identities");
        assert.isAtMost(snapshot.aggregates.length, 5_000);
        assert.deepInclude(truncation, { retained: 5_000, truncated: true });
        assert.equal(snapshot.aggregates.find(item => item.kind === "profiler.aggregate.other")!.statistics.count, 101);
    });

    it("should update counters and gauges without committing overflowing values", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });

        runtime.increment("counter", Number.MAX_VALUE, { scope: "worker" });
        runtime.increment("counter", Number.MAX_VALUE, { scope: "worker" });
        runtime.sample("gauge", 2, { scope: "worker" });
        runtime.sample("gauge", 3, { scope: "worker" });
        runtime.stop();

        assert.deepInclude(runtime.snapshot().metrics.find(metric => metric.name === "counter")!, {
            value: Number.MAX_VALUE,
            mode: "counter",
            dimensions: { scope: "worker" },
        });
        assert.deepInclude(runtime.snapshot().metrics.find(metric => metric.name === "gauge")!, {
            value: 3,
            mode: "gauge",
            dimensions: { scope: "worker" },
        });
        assert.deepInclude(runtime.snapshot().errors.find(error => error.stage === "runtime.metric")!, {
            message: "Metric counter overflowed",
        });
    });

    it("should record resource samples with dimensions and tear the sampler down on stop", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
            process: { type: "worker", pid: 2 },
        });
        const internals = runtime as unknown as {
            _recordResourceSample(name: string, value: number, dimensions: Record<string, string>): void;
            _sampler?: NodeJS.Timeout;
        };

        assert.exists(internals._sampler);
        internals._recordResourceSample("process.eventLoopUtilization", 0.75, {
            process: "worker",
        });
        runtime.stop();

        assert.notExists(internals._sampler);
        assert.deepInclude(runtime.snapshot().metrics.find(metric => metric.name === "process.eventLoopUtilization")!, {
            value: 0.75,
            dimensions: { process: "worker" },
        });
        const resourceAggregate = runtime
            .snapshot()
            .aggregates.find(aggregate => aggregate.name === "process.eventLoopUtilization")!;
        assert.deepInclude(resourceAggregate, {
            attributes: { process: "worker" },
        });
        assert.deepInclude(resourceAggregate.statistics, { count: 1, sum: 0.75 });
    });
});
