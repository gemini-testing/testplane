import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";
import os from "node:os";
import { isProxy } from "node:util/types";
import type {
    CorrelationContext,
    EnabledProfilerLevel,
    MeasurementQuality,
    ProcessRef,
    ProfilerError,
    ProfilerValue,
    RetainedOperation,
} from "../schema";
import { OperationStore } from "../retention/operation-store";
import { RETENTION_POLICY_V1 } from "../retention/policy-v1";
import { StreamingStatistics } from "../retention/streaming-statistics";
import type { BootstrapProbe } from "./bootstrap-probe";
import { cpuUsageToMs, ProfilerClock, systemClock } from "./clock";
import type { RuntimeAggregate, RuntimeMetric, RuntimeSnapshot, SpanHandle, SpanOptions } from "./types";
import { AsyncActivityTracker } from "./async-activity";

interface OpenSpan {
    id: string;
    kind: string;
    name: string;
    parentId?: string;
    context: CorrelationContext;
    process: ProcessRef;
    source?: SpanOptions["source"];
    attributes: Record<string, ProfilerValue>;
    quality: MeasurementQuality;
    /** Monotonic clock value captured when the span started. */
    startMs: number;
    processCpu: NodeJS.CpuUsage;
    threadCpu?: NodeJS.CpuUsage;
    /** Node.js event-loop utilization snapshot captured when the span started. */
    eventLoopUtilization?: ReturnType<typeof performance.eventLoopUtilization>;
    ended: boolean;
    /** Monotonic clock value captured when the span ended. */
    endMs?: number;
    previousSibling?: OpenSpan;
    nextSibling?: OpenSpan;
    childIntervalHead?: OpenSpan;
    childIntervalTail?: OpenSpan;
    /** Combined elapsed time covered by completed direct children, with overlaps counted once. */
    childUnionMs: number;
    /** End of the latest interval already included in `childUnionMs`. */
    childUnionEndMs: number;
}

interface AggregateState {
    kind: string;
    name: string;
    attributes?: Record<string, ProfilerValue>;
    statistics: StreamingStatistics;
}

const DEFAULT_QUALITY: MeasurementQuality = {
    timing: "exact",
    cpu: "process-window",
};

const SAMPLING_INTERVAL: Record<EnabledProfilerLevel, number> = {
    1: 500,
    2: 250,
    3: 100,
};
const EVENT_LOOP_DELAY_RESOLUTION_MS = 10;

const NOOP_SPAN: SpanHandle = Object.freeze({ end: () => undefined });

export class ProfilerRuntime {
    readonly level: EnabledProfilerLevel;
    readonly runId: string;
    /** High-resolution monotonic clock value used as offset `0` for local elapsed-time measurements. */
    readonly originMonotonicMs: number;
    /** Unix timestamp in milliseconds that corresponds to `originMonotonicMs`. */
    readonly originEpochMs: number;

    private readonly _clock: ProfilerClock;
    private readonly _process: ProcessRef;
    private readonly _operationIdPrefix: string;
    private readonly _context = new AsyncLocalStorage<CorrelationContext>();
    private readonly _openSpans = new Map<string, OpenSpan>();
    private readonly _operations = new OperationStore();
    private readonly _aggregates = new Map<string, AggregateState>();
    private readonly _metrics = new Map<string, RuntimeMetric>();
    private readonly _errors: ProfilerError[] = [];
    private _idSequence = 0;
    private _stopped = false;
    private _overheadMs = 0;
    private _sampler?: NodeJS.Timeout;
    private _lastElu?: ReturnType<typeof performance.eventLoopUtilization>;
    private readonly _asyncActivity?: AsyncActivityTracker;
    private _eventLoopDelay?: IntervalHistogram;
    private _lastHostCpu?: { busy: number; total: number };
    private _aggregateIdentitiesSeen = 0;
    private _aggregateIdentityOverflow = 0;
    private _metricIdentitiesSeen = 0;
    private _metricIdentityOverflow = 0;

    constructor(options: {
        runId: string;
        level: EnabledProfilerLevel;
        process?: ProcessRef;
        clock?: ProfilerClock;
        /** High-resolution monotonic clock value to use as offset `0`. */
        originMonotonicMs?: number;
        /** Unix timestamp in milliseconds that corresponds to `originMonotonicMs`. */
        originEpochMs?: number;
    }) {
        this.runId = options.runId;
        this.level = options.level;
        this._clock = options.clock ?? systemClock;
        this._process = options.process ?? { type: "master", pid: process.pid };
        this._operationIdPrefix = operationIdPrefix(this.runId, this._process);
        this.originMonotonicMs = options.originMonotonicMs ?? this._clock.now();
        this.originEpochMs =
            options.originEpochMs ?? this._clock.epochNow() - (this._clock.now() - this.originMonotonicMs);

        if (this.level >= 3) {
            try {
                this._asyncActivity = new AsyncActivityTracker(
                    this._clock,
                    () => this._context.getStore()?.spanId,
                    error => this.recordError("runtime.asyncActivity", error),
                );
            } catch (error) {
                this.recordError("runtime.asyncActivity.setup", error);
            }
        }

        this._startResourceSampler();
    }

    isEnabled(minLevel: EnabledProfilerLevel = 1): boolean {
        return !this._stopped && this.level >= minLevel;
    }

    adoptBootstrapProbe(probe: BootstrapProbe): void {
        const records = probe.takeRecords();
        const operationIds = new Map(records.map(record => [record.id, this._nextId("bootstrap")]));
        for (const record of records) {
            const operation: RetainedOperation = {
                id: operationIds.get(record.id)!,
                parentId: record.parentId === undefined ? undefined : operationIds.get(record.parentId),
                kind: record.kind,
                name: record.name,
                process: this._process,
                context: { runId: this.runId },
                startOffsetMs: Math.max(0, record.startMs - this.originMonotonicMs),
                timing: {
                    wallMs: Math.max(0, record.endMs - record.startMs),
                    processCpuMs: record.processCpuMs,
                },
                attributes: {},
                quality: DEFAULT_QUALITY,
                status: record.status,
            };

            this._recordOperation(operation);
        }
    }

    startSpan(kind: string, options: SpanOptions = {}): SpanHandle {
        if (!this.isEnabled(options.minLevel)) {
            return NOOP_SPAN;
        }

        const overheadStart = this._clock.now();
        try {
            const current = this._context.getStore();
            const id = this._nextId("span");
            const context: CorrelationContext = {
                runId: this.runId,
                ...current,
                ...options.context,
                spanId: id,
            };
            const span: OpenSpan = {
                id,
                kind,
                name: options.name ?? kind,
                parentId: options.parentId ?? current?.spanId,
                context,
                process: options.process ?? this._process,
                source: options.source,
                attributes: options.attributes ?? {},
                quality: { ...DEFAULT_QUALITY, ...options.quality },
                startMs: this._clock.now(),
                processCpu: this._clock.cpuUsage(),
                threadCpu: this.level >= 3 && this._clock.threadCpuUsage ? this._clock.threadCpuUsage() : undefined,
                eventLoopUtilization:
                    typeof performance.eventLoopUtilization === "function"
                        ? performance.eventLoopUtilization()
                        : undefined,
                ended: false,
                childUnionMs: 0,
                childUnionEndMs: Number.NEGATIVE_INFINITY,
            };
            this._openSpans.set(id, span);
            this._asyncActivity?.startSpan(id);
            this._registerChildInterval(span);

            return {
                id,
                end: status => this._endSpan(span, status),
            };
        } catch (error) {
            this.recordError("runtime.startSpan", error);
            return NOOP_SPAN;
        } finally {
            this._overheadMs += Math.max(0, this._clock.now() - overheadStart);
        }
    }

    withSpan<T>(kind: string, options: SpanOptions, action: () => T): T {
        if (!this.isEnabled(options.minLevel)) {
            return action();
        }

        const span = this.startSpan(kind, options);
        const context = {
            ...(this._context.getStore() ?? { runId: this.runId }),
            spanId: span.id,
        };

        return this._context.run(context, () => {
            try {
                const result = this._asyncActivity ? this._asyncActivity.measureSynchronous(span.id, action) : action();
                if (isPromiseLike(result)) {
                    return result.then(
                        value => {
                            span.end();
                            return value;
                        },
                        error => {
                            span.end("failed");
                            throw error;
                        },
                    ) as T;
                }

                span.end();
                return result;
            } catch (error) {
                span.end("failed");
                throw error;
            }
        });
    }

    withContext<T>(context: Partial<CorrelationContext>, action: () => T): T {
        if (this._stopped) {
            return action();
        }

        return this._context.run(
            {
                runId: this.runId,
                ...this._context.getStore(),
                ...context,
            },
            action,
        );
    }

    increment(metric: string, value = 1, dimensions: Record<string, ProfilerValue> = {}): void {
        if (!this.isEnabled()) {
            return;
        }

        this._updateMetric(metric, value, dimensions, true);
    }

    sample(metric: string, value: number, dimensions: Record<string, ProfilerValue> = {}): void {
        if (!this.isEnabled()) {
            return;
        }

        this._updateMetric(metric, value, dimensions, false);
    }

    recordError(stage: string, error: unknown): void {
        if (this._errors.length >= RETENTION_POLICY_V1.maxErrors) {
            return;
        }

        const code = readOwnDataProperty(error, "code");
        const ownMessage = readOwnDataProperty(error, "message");
        this._errors.push({
            stage: stage.slice(0, 200),
            code: typeof code === "string" ? code.slice(0, 100) : undefined,
            message: (typeof ownMessage === "string" ? ownMessage : safeString(error)).slice(0, 1000),
        });
    }

    recordMeasurement(
        kind: string,
        durationMs: number,
        options: SpanOptions = {},
        status: "completed" | "failed" | "interrupted" = "completed",
    ): void {
        if (!this.isEnabled(options.minLevel) || !Number.isFinite(durationMs) || durationMs < 0) {
            return;
        }
        try {
            const current = this._context.getStore();
            const id = this._nextId("measurement");
            this._recordOperation({
                id,
                parentId: options.parentId ?? current?.spanId,
                kind,
                name: options.name ?? kind,
                process: options.process ?? this._process,
                context: {
                    runId: this.runId,
                    ...current,
                    ...options.context,
                    spanId: id,
                },
                startOffsetMs: Math.max(0, this._clock.now() - this.originMonotonicMs - durationMs),
                timing: { wallMs: durationMs },
                source: options.source,
                attributes: options.attributes ?? {},
                quality: {
                    ...DEFAULT_QUALITY,
                    timing: "estimated",
                    ...options.quality,
                },
                status,
            });
        } catch (error) {
            this.recordError("runtime.recordMeasurement", error);
        }
    }

    closeOpenSpans(): void {
        for (const span of [...this._openSpans.values()].reverse()) {
            this._endSpan(span, "interrupted");
        }
    }

    stop(): void {
        if (this._stopped) {
            return;
        }

        this.closeOpenSpans();
        this._stopped = true;
        if (this._sampler) {
            clearInterval(this._sampler);
            this._sampler = undefined;
        }
        this._eventLoopDelay?.disable();
        this._eventLoopDelay = undefined;
        this._asyncActivity?.disable();
    }

    snapshot(): RuntimeSnapshot {
        const { operations, truncation } = this._operations.snapshot();

        return {
            runId: this.runId,
            level: this.level,
            originEpochMs: this.originEpochMs,
            operations,
            aggregates: this._snapshotAggregates(this._aggregates),
            metrics: [...this._metrics.values()],
            errors: [...this._errors],
            truncation: [
                ...truncation,
                ...(this._aggregateIdentityOverflow > 0
                    ? [
                          {
                              collector: "aggregate-identities",
                              seen: this._aggregateIdentitiesSeen,
                              retained: this._aggregates.size,
                              rule: `retain at most ${RETENTION_POLICY_V1.maxAggregateIdentities} aggregate identities; merge overflow into <other>`,
                              truncated: true,
                          },
                      ]
                    : []),
                ...(this._metricIdentityOverflow > 0
                    ? [
                          {
                              collector: "metric-identities",
                              seen: this._metricIdentitiesSeen,
                              retained: this._metrics.size,
                              rule: `retain at most ${RETENTION_POLICY_V1.maxAggregateIdentities} metric identities; merge overflow into profiler.metric.other`,
                              truncated: true,
                          },
                      ]
                    : []),
            ],
            overheadMs: this._overheadMs,
            clock: { unalignedFragments: 0 },
        };
    }

    private _endSpan(span: OpenSpan, status: "completed" | "failed" | "interrupted" = "completed"): void {
        if (span.ended) {
            return;
        }

        const overheadStart = this._clock.now();
        try {
            span.ended = true;
            this._openSpans.delete(span.id);
            const endMs = this._clock.now();
            span.endMs = endMs;
            const wallMs = Math.max(0, endMs - span.startMs);
            this._completeChildInterval(span);
            this._flushOpenChildIntervals(span, endMs);
            const elu = span.eventLoopUtilization
                ? performance.eventLoopUtilization(span.eventLoopUtilization)
                : undefined;
            const threadCpuMs =
                span.threadCpu && this._clock.threadCpuUsage
                    ? cpuUsageToMs(this._clock.threadCpuUsage(span.threadCpu))
                    : undefined;
            const measuredActiveJsMs = this._asyncActivity?.finishSpan(span.id);
            const activeJsMs = measuredActiveJsMs === undefined ? undefined : Math.min(wallMs, measuredActiveJsMs);

            this._recordOperation({
                id: span.id,
                parentId: span.parentId,
                kind: span.kind,
                name: span.name,
                process: span.process,
                context: span.context,
                startOffsetMs: Math.max(0, span.startMs - this.originMonotonicMs),
                timing: {
                    wallMs,
                    processCpuMs: cpuUsageToMs(this._clock.cpuUsage(span.processCpu)),
                    threadCpuMs,
                    activeJsMs,
                    waitingMs: activeJsMs === undefined ? undefined : Math.max(0, wallMs - activeJsMs),
                    eventLoopUtilization: elu?.utilization,
                    observedChildUnionMs: span.childUnionMs > 0 ? Math.min(wallMs, span.childUnionMs) : undefined,
                },
                source: span.source,
                attributes: span.attributes,
                quality: {
                    ...span.quality,
                    cpu: threadCpuMs === undefined ? span.quality.cpu : "thread",
                    notes:
                        activeJsMs === undefined
                            ? span.quality.notes
                            : [
                                  ...(span.quality.notes ?? []),
                                  "activeJsMs is best-effort async_hooks callback attribution",
                              ],
                },
                status,
            });
        } catch (error) {
            this.recordError("runtime.endSpan", error);
        } finally {
            span.childIntervalHead = undefined;
            span.childIntervalTail = undefined;
            this._overheadMs += Math.max(0, this._clock.now() - overheadStart);
        }
    }

    private _registerChildInterval(span: OpenSpan): void {
        if (!span.parentId) {
            return;
        }
        const parent = this._openSpans.get(span.parentId);
        if (!parent) {
            return;
        }

        if (parent.childIntervalTail) {
            span.previousSibling = parent.childIntervalTail;
            parent.childIntervalTail.nextSibling = span;
        } else {
            parent.childIntervalHead = span;
        }
        parent.childIntervalTail = span;
    }

    private _completeChildInterval(span: OpenSpan): void {
        if (!span.parentId) {
            return;
        }

        const parent = this._openSpans.get(span.parentId);
        if (!parent) {
            return;
        }
        const previous = span.previousSibling;
        const next = span.nextSibling;
        if (previous) {
            previous.nextSibling = next;
        } else {
            parent.childIntervalHead = next;
            this._mergeChildInterval(parent, span.startMs, span.endMs!);
        }
        if (next) {
            next.previousSibling = previous;
        } else {
            parent.childIntervalTail = previous;
        }
        span.previousSibling = undefined;
        span.nextSibling = undefined;
    }

    private _flushOpenChildIntervals(parent: OpenSpan, endMs: number): void {
        let child = parent.childIntervalHead;
        if (child) {
            this._mergeChildInterval(parent, child.startMs, endMs);
        }
        while (child) {
            const next = child.nextSibling;
            child.previousSibling = undefined;
            child.nextSibling = undefined;
            child = next;
        }
        parent.childIntervalHead = undefined;
        parent.childIntervalTail = undefined;
    }

    // Intervals reach this point in non-decreasing start order, so the running union stays exact in O(1).
    private _mergeChildInterval(parent: OpenSpan, startMs: number, endMs: number): void {
        if (startMs >= parent.childUnionEndMs) {
            parent.childUnionMs += Math.max(0, endMs - startMs);
            parent.childUnionEndMs = endMs;
        } else {
            parent.childUnionMs += Math.max(0, endMs - parent.childUnionEndMs);
            parent.childUnionEndMs = Math.max(parent.childUnionEndMs, endMs);
        }
    }

    private _recordOperation(operation: RetainedOperation): void {
        this._operations.add(operation);

        if (operation.kind === "test.file.load" && operation.process.type === "master") {
            this._addLocalAggregate("test.file.load.summary", operation.process.type, operation.timing.wallMs, {
                process: operation.process.type,
            });
        }

        if (operation.kind === "browser.command") {
            this._addLocalAggregate("browser.command.cumulative", "<all>", operation.timing.wallMs);

            const parentKind = operation.parentId ? this._openSpans.get(operation.parentId)?.kind : undefined;
            if (parentKind !== "browser.command") {
                this._addLocalAggregate("browser.command.root", "<root>", operation.timing.wallMs);
            }
        }

        this._addLocalAggregate(operation.kind, operation.name, operation.timing.wallMs);
    }

    private _addLocalAggregate(
        kind: string,
        name: string,
        value: number,
        attributes?: Record<string, ProfilerValue>,
    ): void {
        this._addAggregate(this._aggregates, kind, name, value, true, attributes);
    }

    private _addAggregate(
        store: Map<string, AggregateState>,
        kind: string,
        name: string,
        value: number,
        trackIdentity = false,
        attributes?: Record<string, ProfilerValue>,
    ): void {
        if (!this._updateAggregate(store, kind, name, attributes, trackIdentity, statistics => statistics.add(value))) {
            this.recordError("runtime.aggregate", new Error(`Aggregate ${kind} overflowed`));
        }
    }

    private _updateAggregate(
        store: Map<string, AggregateState>,
        kind: string,
        name: string,
        attributes: Record<string, ProfilerValue> | undefined,
        trackIdentity: boolean,
        update: (statistics: StreamingStatistics) => boolean,
    ): boolean {
        let key = `${kind}\0${name}\0${stableAttributesKey(attributes)}`;
        const isNewIdentity = !store.has(key);
        let overflowed = false;
        if (isNewIdentity) {
            if (store.size >= RETENTION_POLICY_V1.maxAggregateIdentities - 1) {
                overflowed = true;
                kind = "profiler.aggregate.other";
                name = "<other>";
                attributes = undefined;
                key = `${kind}\0${name}\0`;
            }
        }
        let aggregate = store.get(key);
        if (!aggregate) {
            aggregate = {
                kind,
                name,
                attributes: attributes && copyDataRecord<Record<string, ProfilerValue>>(attributes),
                statistics: new StreamingStatistics(),
            };
        }
        if (!update(aggregate.statistics)) {
            return false;
        }
        if (!store.has(key)) {
            store.set(key, aggregate);
        }
        if (trackIdentity && isNewIdentity) {
            this._aggregateIdentitiesSeen += 1;
            if (overflowed) {
                this._aggregateIdentityOverflow += 1;
            }
        }
        return true;
    }

    private _updateMetric(
        metric: string,
        value: number,
        dimensions: Record<string, ProfilerValue>,
        increment: boolean,
    ): void {
        if (!Number.isFinite(value)) {
            this.recordError("runtime.metric", new Error(`Metric ${metric} has a non-finite value`));
            return;
        }

        let normalizedDimensions = copyEntriesToDataRecord(
            Object.entries(dimensions)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, dimension]) => [key.slice(0, 100), dimension]),
        );
        let normalizedMetric = metric;
        let key = `${normalizedMetric} ${stableAttributesKey(normalizedDimensions)}`;
        const isNewIdentity = !this._metrics.has(key);
        let overflowed = false;
        if (isNewIdentity && this._metrics.size >= RETENTION_POLICY_V1.maxAggregateIdentities - 1) {
            overflowed = true;
            normalizedMetric = "profiler.metric.other";
            normalizedDimensions = Object.create(null) as Record<string, ProfilerValue>;
            key = `${normalizedMetric} {}`;
        }
        const current = this._metrics.get(key);
        const nextValue = increment ? (current?.value ?? 0) + value : value;
        if (!Number.isFinite(nextValue)) {
            this.recordError("runtime.metric", new Error(`Metric ${metric} overflowed`));
            return;
        }

        this._metrics.set(key, {
            name: normalizedMetric,
            value: nextValue,
            dimensions: normalizedDimensions,
            mode: increment ? "counter" : "gauge",
        });
        if (isNewIdentity) {
            this._metricIdentitiesSeen += 1;
            if (overflowed) {
                this._metricIdentityOverflow += 1;
            }
        }
    }

    private _startResourceSampler(): void {
        if (typeof performance.eventLoopUtilization === "function") {
            this._lastElu = performance.eventLoopUtilization();
        }
        try {
            this._eventLoopDelay = monitorEventLoopDelay({
                resolution: EVENT_LOOP_DELAY_RESOLUTION_MS,
            });
            this._eventLoopDelay.enable();
        } catch (error) {
            this.recordError("runtime.eventLoopDelay.setup", error);
        }
        if (this._process.type === "master") {
            this._lastHostCpu = readHostCpu();
        }

        this._sampler = setInterval(() => {
            try {
                if (this._lastElu) {
                    const current = performance.eventLoopUtilization(this._lastElu);
                    this._lastElu = performance.eventLoopUtilization();
                    this._recordResourceSample("process.eventLoopUtilization", current.utilization, {
                        process: this._process.type,
                    });
                }
                const memory = process.memoryUsage();
                this._recordResourceSample("process.rssBytes", memory.rss, {
                    process: this._process.type,
                });
                if (this._eventLoopDelay && Number.isFinite(this._eventLoopDelay.percentile(95))) {
                    this._recordResourceSample(
                        "process.eventLoopDelayP95Ms",
                        this._eventLoopDelay.percentile(95) / 1_000_000,
                        { process: this._process.type },
                    );
                    this._eventLoopDelay.reset();
                }
                if (this._process.type === "master" && this._lastHostCpu) {
                    const hostCpu = readHostCpu();
                    const totalDelta = hostCpu.total - this._lastHostCpu.total;
                    const busyDelta = hostCpu.busy - this._lastHostCpu.busy;
                    this._lastHostCpu = hostCpu;
                    if (totalDelta > 0) {
                        this._recordResourceSample("host.cpuUtilization", busyDelta / totalDelta, {
                            process: "host",
                        });
                    }
                }
            } catch (error) {
                this.recordError("runtime.resourceSampler", error);
            }
        }, SAMPLING_INTERVAL[this.level]);
        this._sampler.unref();
    }

    private _recordResourceSample(metric: string, value: number, dimensions: Record<string, ProfilerValue>): void {
        this.sample(metric, value, dimensions);
        this._addLocalAggregate("metric.sample", metric, value, dimensions);
    }

    private _snapshotAggregates(store: Map<string, AggregateState>): RuntimeAggregate[] {
        return [...store.values()].map(({ kind, name, attributes, statistics }) => ({
            kind,
            name,
            attributes,
            statistics: statistics.snapshot(),
        }));
    }

    private _nextId(prefix: string): string {
        this._idSequence += 1;
        return `${this._operationIdPrefix}:${prefix}:${this._idSequence}`;
    }
}
function operationIdPrefix(runId: string, processRef: ProcessRef): string {
    if (processRef.type === "master") {
        return runId;
    }

    const processIdentity =
        processRef.workerInstanceId ??
        processRef.browserId ??
        (processRef.pid === undefined ? "unknown" : processRef.pid);
    return `${runId}:${processRef.type}:${processIdentity}`;
}

function stableAttributesKey(attributes?: Record<string, ProfilerValue>): string {
    if (!attributes) {
        return "";
    }

    return stringifyDataValue(
        copyEntriesToDataRecord(Object.entries(attributes).sort(([left], [right]) => left.localeCompare(right))),
    );
}

function copyDataRecord<T extends object>(source: object, overrides?: Record<string, unknown>): T {
    const target = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(source)) {
        target[key] = normalizeDataValue(readOwnDataProperty(source, key));
    }
    for (const key of Object.keys(overrides ?? {})) {
        target[key] = normalizeDataValue(readOwnDataProperty(overrides, key));
    }
    return target as T;
}

function copyEntriesToDataRecord(entries: [string, ProfilerValue][]): Record<string, ProfilerValue> {
    const target = Object.create(null) as Record<string, ProfilerValue>;
    for (const [key, value] of entries) {
        target[key] = value;
    }
    return target;
}

function normalizeDataValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        const length = readOwnDataProperty(value, "length");
        if (!Number.isSafeInteger(length) || (length as number) < 0) {
            throw new Error("Invalid data array length");
        }
        const normalized = new Array<unknown>(length as number);
        for (let index = 0; index < normalized.length; index += 1) {
            normalized[index] = normalizeDataValue(readOwnDataProperty(value, String(index)));
        }
        return normalized;
    }
    if (value && typeof value === "object") {
        return copyDataRecord(value);
    }
    return value;
}

function stringifyDataValue(value: unknown): string {
    if (value === null) {
        return "null";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return JSON.stringify(value);
    }
    if (value === undefined) {
        return "null";
    }
    if (Array.isArray(value)) {
        const entries: string[] = [];
        const length = readOwnDataProperty(value, "length") as number;
        for (let index = 0; index < length; index += 1) {
            entries.push(stringifyDataValue(readOwnDataProperty(value, String(index))));
        }
        return `[${entries.join(",")}]`;
    }
    if (typeof value === "object") {
        const entries: string[] = [];
        for (const key of Object.keys(value)) {
            const entry = readOwnDataProperty(value, key);
            if (entry !== undefined) {
                entries.push(`${JSON.stringify(key)}:${stringifyDataValue(entry)}`);
            }
        }
        return `{${entries.join(",")}}`;
    }
    throw new Error("Unsupported profiler data value");
}

function isPromiseLike<T>(value: T): value is T & PromiseLike<Awaited<T>> {
    return Boolean(value && typeof (value as { then?: unknown }).then === "function");
}

function readHostCpu(): { busy: number; total: number } {
    let busy = 0;
    let total = 0;
    for (const cpu of os.cpus()) {
        const cpuTotal = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
        total += cpuTotal;
        busy += cpuTotal - cpu.times.idle;
    }
    return { busy, total };
}

function safeString(value: unknown): string {
    switch (typeof value) {
        case "string":
        case "number":
        case "boolean":
        case "undefined":
        case "bigint":
            return String(value);
        default:
            return value === null ? "null" : `<${typeof value}>`;
    }
}

function readOwnDataProperty(value: unknown, key: PropertyKey): unknown {
    if (!value || (typeof value !== "object" && typeof value !== "function") || isProxy(value)) {
        return;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
