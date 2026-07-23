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

    it("should execute the strict no-op path without producing a snapshot", () => {
        const action = sinon.spy(() => "result");

        assert.equal(noopProfilerRuntime.withSpan("ignored", {}, action), "result");
        assert.isFalse(noopProfilerRuntime.isEnabled());
        assert.isNull(noopProfilerRuntime.snapshot());
        assert.calledOnce(action);
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
});
