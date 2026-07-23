import sinon from "sinon";

import type { ProfilerClock } from "src/profiler/runtime/clock";
import { noopProfilerRuntime } from "src/profiler/runtime/noop";
import { ProfilerRuntime } from "src/profiler/runtime/runtime";
import type { ProfilerFragment } from "src/profiler/runtime/types";
import { RETENTION_POLICY_V1 } from "src/profiler/retention/policy-v1";
import type { RetainedOperation } from "src/profiler/schema";

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

    it("should preserve full worker aggregates when retained details are truncated", () => {
        const workerClock = createClock();
        const listenerLimit = RETENTION_POLICY_V1.operationLimits["event.listener"];
        const listenerCount = listenerLimit + 50;
        const worker = new ProfilerRuntime({
            runId: "worker-run",
            level: 2,
            clock: workerClock,
            process: { type: "worker", pid: 2 },
        });
        for (let index = 0; index < listenerCount; index += 1) {
            const span = worker.startSpan("event.listener", { name: "listener" });
            workerClock.advance(1);
            span.end();
        }

        const master = new ProfilerRuntime({
            runId: "master-run",
            level: 2,
            clock: createClock(),
        });
        master.ingestFragment(worker.takeFragment());
        worker.stop();
        master.stop();

        const aggregate = master.snapshot().aggregates.find(item => item.kind === "event.listener");
        assert.equal(aggregate!.statistics.count, listenerCount);
        assert.lengthOf(
            master.snapshot().operations.filter(operation => operation.kind === "event.listener"),
            listenerLimit,
        );
    });

    it("should preserve resource sample process dimensions across worker fragments", () => {
        const worker = new ProfilerRuntime({
            runId: "worker-run",
            level: 2,
            clock: createClock(),
            process: { type: "worker", pid: 2 },
        });
        (
            worker as unknown as {
                _recordResourceSample(name: string, value: number, dimensions: Record<string, string>): void;
            }
        )._recordResourceSample("process.eventLoopUtilization", 0.9, {
            process: "worker",
        });
        const master = new ProfilerRuntime({
            runId: "master-run",
            level: 2,
            clock: createClock(),
        });

        master.ingestFragment(worker.takeFragment());
        worker.stop();
        master.stop();

        const aggregate = master
            .snapshot()
            .aggregates.find(item => item.kind === "metric.sample" && item.name === "process.eventLoopUtilization");
        assert.deepEqual(aggregate!.attributes, { process: "worker" });
        assert.deepInclude(aggregate!.statistics, { count: 1, sum: 0.9 });
    });

    it("should reject malformed worker fragments without throwing", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        let getterCalled = false;
        const accessorQuality = {};
        Object.defineProperty(accessorQuality, "timing", {
            enumerable: true,
            get: () => {
                getterCalled = true;
                return "exact";
            },
        });
        const nonEnumerableQuality = { cpu: "process-window" };
        Object.defineProperty(nonEnumerableQuality, "timing", { value: "exact" });
        let proxyRead = false;
        const proxiedQuality = new Proxy(
            { timing: "exact", cpu: "process-window" },
            {
                get: (target, key, receiver): unknown => {
                    proxyRead = true;
                    return Reflect.get(target, key, receiver);
                },
            },
        );
        const validOperation: RetainedOperation = {
            id: "valid",
            kind: "test",
            name: "valid",
            process: { type: "worker", pid: 2 },
            context: {},
            startOffsetMs: 0,
            timing: { wallMs: 1 },
            attributes: {},
            quality: { timing: "exact", cpu: "process-window" },
            status: "completed",
        };
        const invalidOperations = [
            {
                ...validOperation,
                id: "timing",
                timing: { wallMs: 1, selfWallMs: "invalid" },
            },
            { ...validOperation, id: "quality", quality: {} },
            { ...validOperation, id: "status", status: "invalid" },
            { ...validOperation, id: "context", context: { attempt: "invalid" } },
            { ...validOperation, id: "source", source: { confidence: "invalid" } },
            { ...validOperation, id: "extra", unexpected: true },
            { ...validOperation, id: "accessor", quality: accessorQuality },
            {
                ...validOperation,
                id: "non-enumerable",
                quality: nonEnumerableQuality,
            },
            { ...validOperation, id: "proxy", quality: proxiedQuality },
            { ...validOperation, id: "pid", process: { type: "worker", pid: -2.5 } },
            { ...validOperation, id: "attempt", context: { attempt: -0.5 } },
            { ...validOperation, id: "negative-offset", startOffsetMs: -1 },
            { ...validOperation, id: "negative-wall", timing: { wallMs: -1 } },
            {
                ...validOperation,
                id: "invalid-elu",
                timing: { wallMs: 1, eventLoopUtilization: 1.5 },
            },
        ];

        const fragment = {
            transportVersion: 1,
            sequence: 1,
            sourceRunId: "worker-run",
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 2 },
            operations: [],
            errors: [],
            truncation: [],
        };

        assert.doesNotThrow(() => runtime.ingestFragment({ transportVersion: 1 }));
        assert.doesNotThrow(() =>
            runtime.ingestFragment({
                transportVersion: {
                    toString: (): never => {
                        throw new Error("unexpected coercion");
                    },
                },
            }),
        );
        assert.doesNotThrow(() => runtime.ingestFragment({ ...fragment, aggregates: {} }));
        assert.doesNotThrow(() => runtime.ingestFragment({ ...fragment, metrics: [null] }));
        assert.doesNotThrow(() => runtime.ingestFragment({ ...fragment, errors: [null] }));
        assert.doesNotThrow(() => runtime.ingestFragment({ ...fragment, truncation: [null] }));
        assert.doesNotThrow(() => runtime.ingestFragment({ ...fragment, truncation: Array(1) }));
        assert.doesNotThrow(() =>
            runtime.ingestFragment({
                ...fragment,
                sourceRunId: "clock",
                clockUncertaintyMs: -1,
            }),
        );
        assert.doesNotThrow(() =>
            runtime.ingestFragment(
                new Proxy(
                    {},
                    {
                        get: (): never => {
                            throw new Error("unexpected property access");
                        },
                        getPrototypeOf: (): never => {
                            throw new Error("unexpected prototype access");
                        },
                    },
                ),
            ),
        );
        assert.doesNotThrow(() =>
            runtime.ingestFragment({
                ...fragment,
                operations: [validOperation, ...invalidOperations],
            }),
        );
        runtime.ingestFragment({
            ...fragment,
            sourceRunId: "unaligned-worker",
            originEpochMs: undefined,
        });
        runtime.stop();

        assert.deepInclude(runtime.snapshot().errors[0], {
            stage: "transport.fragment",
        });
        assert.deepEqual(
            runtime.snapshot().operations.map(operation => operation.id),
            ["valid"],
        );
        assert.lengthOf(
            runtime.snapshot().errors.filter(error => error.stage === "transport.operation"),
            invalidOperations.length,
        );
        assert.isFalse(getterCalled);
        assert.isFalse(proxyRead);
        assert.equal(runtime.snapshot().clock.unalignedFragments, 1);
    });

    it("should reject hostile transport accessors and decorated arrays without executing them", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        const fragment = {
            transportVersion: 1,
            sequence: 1,
            sourceRunId: "worker-run",
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 2 },
            operations: [],
            errors: [],
            truncation: [],
        };
        let transportVersionRead = false;
        const accessorVersion = {};
        Object.defineProperty(accessorVersion, "transportVersion", {
            enumerable: true,
            get: () => {
                transportVersionRead = true;
                return 1;
            },
        });
        const coerceVersion = sinon.spy(() => "2");
        const objectVersion = {
            transportVersion: { [Symbol.toPrimitive]: coerceVersion },
        };
        const ownIterator = sinon.spy(function* (): Generator<never> {});
        const decoratedOperations: unknown[] = [];
        Object.defineProperty(decoratedOperations, Symbol.iterator, {
            value: ownIterator,
        });
        const ownEvery = sinon.spy(() => true);
        const decoratedErrors: unknown[] = [null];
        Object.defineProperty(decoratedErrors, "every", { value: ownEvery });
        const prototypeIterator = sinon.spy(function* (): Generator<never> {});
        const customPrototypeOperations: unknown[] = [];
        Object.setPrototypeOf(customPrototypeOperations, {
            [Symbol.iterator]: prototypeIterator,
        });
        const frozenOperations = Object.freeze([]);

        assert.doesNotThrow(() => runtime.ingestFragment(accessorVersion));
        assert.doesNotThrow(() => runtime.ingestFragment(objectVersion));
        assert.doesNotThrow(() => runtime.ingestFragment({ ...fragment, operations: decoratedOperations }));
        assert.doesNotThrow(() => runtime.ingestFragment({ ...fragment, errors: decoratedErrors }));
        assert.doesNotThrow(() =>
            runtime.ingestFragment({
                ...fragment,
                operations: customPrototypeOperations,
            }),
        );
        assert.doesNotThrow(() => runtime.ingestFragment({ ...fragment, operations: frozenOperations }));
        runtime.stop();

        assert.isFalse(transportVersionRead);
        assert.notCalled(coerceVersion);
        assert.notCalled(ownIterator);
        assert.notCalled(ownEvery);
        assert.notCalled(prototypeIterator);
        assert.isEmpty(runtime.snapshot().operations);
    });

    it("should not execute inherited Object.prototype getters during validation or application", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        const inheritedRead = sinon.spy(() => undefined);
        const inheritedKeys = [
            "workerInstanceId",
            "browserId",
            "parentId",
            "source",
            "notes",
            "samples",
            "metrics",
            "clockUncertaintyMs",
            "code",
        ];
        const previousDescriptors = new Map(
            inheritedKeys.map(key => [key, Object.getOwnPropertyDescriptor(Object.prototype, key)]),
        );
        const operation: RetainedOperation = {
            id: "inherited-safe",
            kind: "test",
            name: "inherited-safe",
            process: { type: "worker", pid: 2 },
            context: {},
            startOffsetMs: 0,
            timing: { wallMs: 1 },
            attributes: {},
            quality: { timing: "exact", cpu: "process-window" },
            status: "completed",
        };
        const fragment = {
            transportVersion: 1,
            sequence: 1,
            sourceRunId: "worker-run",
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 2 },
            operations: [operation],
            aggregates: [
                {
                    kind: "inherited.aggregate",
                    name: "safe",
                    statistics: {
                        count: 1,
                        sum: 1,
                        min: 1,
                        max: 1,
                        mean: 1,
                        variance: 0,
                    },
                },
            ],
            errors: [{ stage: "safe", message: "safe" }],
            truncation: [],
        };

        /* eslint-disable no-extend-native -- adversarial transport regression */
        try {
            for (const key of inheritedKeys) {
                Object.defineProperty(Object.prototype, key, {
                    configurable: true,
                    get: inheritedRead,
                });
            }
            assert.doesNotThrow(() => runtime.ingestFragment(fragment));
        } finally {
            for (const key of inheritedKeys) {
                const descriptor = previousDescriptors.get(key);
                if (descriptor) {
                    Object.defineProperty(Object.prototype, key, descriptor);
                } else {
                    delete (Object.prototype as Record<string, unknown>)[key];
                }
            }
        }
        /* eslint-enable no-extend-native */
        runtime.stop();

        assert.notCalled(inheritedRead);
        assert.deepEqual(
            runtime.snapshot().operations.map(item => item.id),
            ["inherited-safe"],
        );
        assert.deepInclude(
            runtime.snapshot().aggregates.find(item => item.kind === "inherited.aggregate")!.statistics,
            {
                count: 1,
                sum: 1,
            },
        );
    });

    it("should reject semantically invalid aggregate and truncation records", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        const fragment = {
            transportVersion: 1,
            sequence: 1,
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 2 },
            operations: [],
            errors: [],
            truncation: [],
        };
        const invalidStatistics = [
            { count: 1, sum: 1, min: 2, max: 1, mean: 1, variance: 0 },
            { count: 1, sum: 1, min: 1, max: 1, mean: 1, variance: -1 },
            { count: 1, sum: 1, min: 1, max: 1, mean: 1, variance: 1 },
            { count: 2, sum: 2, min: 1, max: 1, mean: 1, variance: 100 },
            { count: 2, sum: 10, min: 0, max: 10, mean: 5, variance: 100 },
            {
                count: Number.MAX_SAFE_INTEGER,
                sum: Number.MAX_SAFE_INTEGER / 2,
                min: 0,
                max: 1,
                mean: 0.5,
                variance: Number.MAX_VALUE,
            },
            {
                count: 3,
                sum: 3,
                min: 0,
                max: 2,
                mean: 1,
                variance: 1,
                p50: 0,
                p95: 2,
                samples: [0, 1, 2],
            },
            {
                count: 2,
                sum: 2,
                min: 0,
                max: 2,
                mean: 1,
                variance: 1,
                p50: 0,
                p95: 0,
                samples: [0, 2],
            },
            {
                count: 3,
                sum: 3,
                min: 0,
                max: 2,
                mean: 1,
                variance: 1,
                p50: 0,
                p95: 2,
            },
            { count: 2, sum: 100, min: 1, max: 2, mean: 1.5, variance: 0 },
            { count: 2, sum: 2, min: 1, max: 2, mean: 2, variance: 0 },
            { count: 1, sum: 1, min: 1, max: 1, mean: 1, variance: 0, samples: [2] },
            { count: 1, sum: 1, min: 1, max: 1, mean: 1, variance: 0, p50: 2 },
            {
                count: 257,
                sum: 257,
                min: 1,
                max: 1,
                mean: 1,
                variance: 0,
                p50: 1,
                p95: 1,
                samples: Array(257).fill(1),
            },
            { count: 0, sum: 1, min: 0, max: 0, mean: 0, variance: 0 },
            {
                count: Number.MAX_SAFE_INTEGER,
                sum: Number.MAX_VALUE,
                min: Number.MAX_VALUE,
                max: Number.MAX_VALUE,
                mean: Number.MAX_VALUE,
                variance: 0,
            },
        ];
        const invalidTruncation = [
            {
                collector: "invalid",
                seen: -1,
                retained: 0,
                rule: "invalid",
                truncated: true,
            },
            {
                collector: "invalid",
                seen: 1,
                retained: 0.5,
                rule: "invalid",
                truncated: true,
            },
            {
                collector: "invalid",
                seen: 1,
                retained: 2,
                rule: "invalid",
                truncated: true,
            },
        ];

        invalidStatistics.forEach((statistics, index) =>
            runtime.ingestFragment({
                ...fragment,
                sourceRunId: `statistics-${index}`,
                aggregates: [{ kind: "invalid", name: "invalid", statistics }],
            }),
        );
        invalidTruncation.forEach((truncation, index) =>
            runtime.ingestFragment({
                ...fragment,
                sourceRunId: `truncation-${index}`,
                truncation: [truncation],
            }),
        );
        runtime.stop();

        assert.lengthOf(
            runtime.snapshot().errors.filter(error => error.stage === "transport.fragment"),
            invalidStatistics.length + invalidTruncation.length,
        );
        assert.isEmpty(runtime.snapshot().aggregates);
        assert.isEmpty(runtime.snapshot().truncation);
    });

    it("should accept statistics that are consistent with a complete sample set", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });

        runtime.ingestFragment({
            transportVersion: 1,
            sequence: 1,
            sourceRunId: "complete-statistics",
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 2 },
            operations: [],
            aggregates: [
                {
                    kind: "valid",
                    name: "complete",
                    statistics: {
                        count: 2,
                        sum: 2,
                        min: 0,
                        max: 2,
                        mean: 1,
                        variance: 2,
                        p50: 0,
                        p95: 0,
                        samples: [0, 2],
                    },
                },
            ],
            errors: [],
            truncation: [],
        });
        runtime.stop();

        assert.deepInclude(runtime.snapshot().aggregates.find(item => item.name === "complete")!.statistics, {
            count: 2,
            sum: 2,
            variance: 2,
        });
    });

    it("should drop overflowing aggregate merges without mutating them and retain valid siblings", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        const fragment = {
            transportVersion: 1,
            sequence: 1,
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 2 },
            operations: [],
            errors: [],
            truncation: [],
        };

        runtime.ingestFragment({
            ...fragment,
            sourceRunId: "aggregate-baseline",
            aggregates: [
                {
                    kind: "overflow",
                    name: "sum",
                    statistics: {
                        count: 1,
                        sum: Number.MAX_VALUE,
                        min: Number.MAX_VALUE,
                        max: Number.MAX_VALUE,
                        mean: Number.MAX_VALUE,
                        variance: 0,
                    },
                },
                {
                    kind: "overflow",
                    name: "count",
                    statistics: {
                        count: Number.MAX_SAFE_INTEGER,
                        sum: 0,
                        min: 0,
                        max: 0,
                        mean: 0,
                        variance: 0,
                    },
                },
                {
                    kind: "overflow",
                    name: "variance",
                    statistics: {
                        count: 1,
                        sum: 0,
                        min: 0,
                        max: 0,
                        mean: 0,
                        variance: 0,
                    },
                },
            ],
        });
        runtime.ingestFragment({
            ...fragment,
            sourceRunId: "aggregate-overflow",
            aggregates: [
                {
                    kind: "overflow",
                    name: "sum",
                    statistics: {
                        count: 1,
                        sum: Number.MAX_VALUE,
                        min: Number.MAX_VALUE,
                        max: Number.MAX_VALUE,
                        mean: Number.MAX_VALUE,
                        variance: 0,
                    },
                },
                {
                    kind: "overflow",
                    name: "count",
                    statistics: {
                        count: 1,
                        sum: 0,
                        min: 0,
                        max: 0,
                        mean: 0,
                        variance: 0,
                    },
                },
                {
                    kind: "overflow",
                    name: "variance",
                    statistics: {
                        count: 1,
                        sum: Number.MAX_VALUE,
                        min: Number.MAX_VALUE,
                        max: Number.MAX_VALUE,
                        mean: Number.MAX_VALUE,
                        variance: 0,
                    },
                },
                {
                    kind: "valid",
                    name: "sibling",
                    statistics: {
                        count: 1,
                        sum: 7,
                        min: 7,
                        max: 7,
                        mean: 7,
                        variance: 0,
                    },
                },
            ],
        });
        runtime.stop();

        const snapshot = runtime.snapshot();
        assert.lengthOf(
            snapshot.errors.filter(error => error.stage === "transport.aggregate"),
            3,
        );
        assert.deepInclude(
            snapshot.aggregates.find(item => item.kind === "overflow" && item.name === "sum")!.statistics,
            {
                count: 1,
                sum: Number.MAX_VALUE,
            },
        );
        assert.deepInclude(
            snapshot.aggregates.find(item => item.kind === "overflow" && item.name === "count")!.statistics,
            { count: Number.MAX_SAFE_INTEGER, sum: 0 },
        );
        assert.deepInclude(
            snapshot.aggregates.find(item => item.kind === "overflow" && item.name === "variance")!.statistics,
            { count: 1, sum: 0, variance: 0 },
        );
        assert.deepInclude(
            snapshot.aggregates.find(item => item.kind === "valid" && item.name === "sibling")!.statistics,
            {
                count: 1,
                sum: 7,
            },
        );
    });

    it("should drop overflowing metric counters and retain valid siblings", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        const fragment = {
            transportVersion: 1,
            sequence: 1,
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 2 },
            operations: [],
            errors: [],
            truncation: [],
        };

        runtime.ingestFragment({
            ...fragment,
            sourceRunId: "metric-baseline",
            metrics: [
                {
                    name: "overflow.counter",
                    value: Number.MAX_VALUE,
                    dimensions: {},
                    mode: "counter",
                },
            ],
        });
        runtime.ingestFragment({
            ...fragment,
            sourceRunId: "metric-overflow",
            metrics: [
                {
                    name: "overflow.counter",
                    value: Number.MAX_VALUE,
                    dimensions: {},
                    mode: "counter",
                },
                { name: "valid.counter", value: 3, dimensions: {}, mode: "counter" },
            ],
        });
        runtime.stop();

        const snapshot = runtime.snapshot();
        assert.deepInclude(snapshot.metrics.find(metric => metric.name === "overflow.counter")!, {
            value: Number.MAX_VALUE,
        });
        assert.deepInclude(snapshot.metrics.find(metric => metric.name === "valid.counter")!, { value: 3 });
        assert.deepInclude(snapshot.errors.find(error => error.stage === "runtime.metric")!, {
            message: "Metric overflow.counter overflowed",
        });
    });

    it("should drop operations whose adjusted start offset overflows and retain valid siblings", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        const operation: RetainedOperation = {
            id: "valid-offset",
            kind: "test",
            name: "valid-offset",
            process: { type: "worker", pid: 2 },
            context: {},
            startOffsetMs: 0,
            timing: { wallMs: 1 },
            attributes: {},
            quality: { timing: "exact", cpu: "process-window" },
            status: "completed",
        };

        runtime.ingestFragment({
            transportVersion: 1,
            sequence: 1,
            sourceRunId: "offset-overflow",
            level: 2,
            originEpochMs: Number.MAX_VALUE,
            process: { type: "worker", pid: 2 },
            operations: [
                {
                    ...operation,
                    id: "overflow-offset",
                    startOffsetMs: Number.MAX_VALUE,
                },
                operation,
            ],
            errors: [],
            truncation: [],
        });
        runtime.stop();

        assert.deepEqual(
            runtime.snapshot().operations.map(item => item.id),
            ["valid-offset"],
        );
        assert.deepInclude(runtime.snapshot().errors.find(error => error.stage === "transport.operation")!, {
            message: "Dropped profiler operation with invalid start offset",
        });
    });

    it("should retain owned copies of accepted worker records", () => {
        const runtime = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
        });
        const operation: RetainedOperation = {
            id: "owned",
            kind: "test",
            name: "owned",
            process: { type: "browser", pid: 2 },
            context: { testId: "test" },
            startOffsetMs: 0,
            timing: { wallMs: 1 },
            source: { file: "test.js", confidence: "high" },
            attributes: { browserId: "chrome" },
            quality: { timing: "exact", cpu: "process-window", notes: ["original"] },
            status: "completed",
        };
        const truncation = {
            collector: "worker",
            seen: 2,
            retained: 1,
            rule: "limit",
            truncated: true,
        };
        const aggregateAttributes = { browserId: "chrome" };
        const fragment: ProfilerFragment = {
            transportVersion: 1,
            sequence: 1,
            sourceRunId: "worker-run",
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 1 },
            operations: [operation],
            aggregates: [
                {
                    kind: "test.aggregate",
                    name: "owned",
                    attributes: aggregateAttributes,
                    statistics: {
                        count: 1,
                        sum: 1,
                        min: 1,
                        max: 1,
                        mean: 1,
                        variance: 0,
                    },
                },
            ],
            errors: [],
            truncation: [truncation],
        };

        runtime.ingestFragment(fragment);
        operation.process.type = "worker";
        operation.context.testId = "mutated";
        operation.timing.wallMs = Number.NaN;
        operation.source!.confidence = "low";
        operation.attributes.browserId = "mutated";
        operation.quality.timing = "sampled";
        operation.quality.notes![0] = "mutated";
        truncation.seen = Number.NaN;
        aggregateAttributes.browserId = "mutated";
        runtime.stop();

        const snapshot = runtime.snapshot();
        assert.deepInclude(snapshot.operations[0], {
            process: { type: "browser", pid: 2 },
            context: { runId: "run", testId: "test" },
            timing: { wallMs: 1 },
            source: { file: "test.js", confidence: "high" },
            attributes: { browserId: "chrome" },
            quality: { timing: "exact", cpu: "process-window", notes: ["original"] },
        });
        assert.deepInclude(snapshot.truncation.find(entry => entry.collector === "worker")!, { seen: 2 });
        assert.deepInclude(snapshot.aggregates.find(entry => entry.kind === "test.aggregate")!, {
            attributes: { browserId: "chrome" },
        });
    });

    it("should emit only non-empty fragments with contiguous sequence numbers", () => {
        const worker = new ProfilerRuntime({
            runId: "worker-run",
            level: 2,
            clock: createClock(),
        });

        assert.isNull(worker.takeFragment());
        worker.recordMeasurement("test.body", 1, { name: "first" });
        const first = worker.takeFragment();
        assert.isNull(worker.takeFragment());
        worker.recordMeasurement("test.body", 1, { name: "second" });
        const second = worker.takeFragment();
        worker.stop();

        assert.equal(first!.sequence, 1);
        assert.equal(second!.sequence, 2);
    });

    it("should publish measured clock uncertainty in worker fragments", () => {
        const worker = new ProfilerRuntime({
            runId: "worker-run",
            level: 2,
            clock: createClock(),
            clockUncertaintyMs: 12.5,
        });
        worker.recordMeasurement("test.body", 1);

        const fragment = worker.takeFragment();
        worker.stop();

        assert.equal(fragment!.clockUncertaintyMs, 12.5);
    });

    it("should retain a fragment parent even when parent-first transport order would evict it", () => {
        const attemptLimit = RETENTION_POLICY_V1.operationLimits["test.attempt"];
        const operation = (id: string, kind: string, wallMs: number, parentId?: string): RetainedOperation => ({
            id,
            parentId,
            kind,
            name: id,
            process: { type: "worker", pid: 2, workerInstanceId: "worker-1" },
            context: { runId: "run" },
            startOffsetMs: 0,
            timing: { wallMs },
            attributes: {},
            quality: { timing: "exact", cpu: "unavailable" },
            status: "completed",
        });
        const fragment: ProfilerFragment = {
            transportVersion: 1,
            sequence: 1,
            sourceRunId: "run",
            level: 2,
            originEpochMs: 1_700_000_000_000,
            process: { type: "worker", pid: 2, workerInstanceId: "worker-1" },
            operations: [
                operation("attempt-0", "test.attempt", 1),
                operation("acquire", "browser.session.acquire", 10_000, "attempt-0"),
                ...Array.from({ length: attemptLimit + 5 }, (_, index) =>
                    operation(`attempt-${index + 1}`, "test.attempt", index + 2),
                ),
            ],
            aggregates: [],
            metrics: [],
            errors: [],
            truncation: [],
        };
        const master = new ProfilerRuntime({
            runId: "run",
            level: 2,
            clock: createClock(),
            originEpochMs: 1_700_000_000_000,
        });

        master.ingestFragment(fragment);
        master.stop();

        const byId = new Map(master.snapshot().operations.map(item => [item.id, item]));
        assert.isTrue(byId.has("acquire"));
        assert.isTrue(byId.has("attempt-0"));
        assert.equal(byId.get("acquire")!.parentId, "attempt-0");
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
