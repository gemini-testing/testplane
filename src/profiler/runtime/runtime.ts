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
    TruncationEntry,
} from "../schema";
import { OperationStore } from "../retention/operation-store";
import { RETENTION_POLICY_V1 } from "../retention/policy-v1";
import {
    DEFAULT_STATISTICS_RESERVOIR_SIZE,
    StreamingStatistics,
    type StatisticsSnapshot,
} from "../retention/streaming-statistics";
import type { BootstrapProbe } from "./bootstrap-probe";
import { cpuUsageToMs, ProfilerClock, systemClock } from "./clock";
import type {
    ProfilerRuntimeLike,
    ProfilerFragment,
    RuntimeAggregate,
    RuntimeMetric,
    RuntimeSnapshot,
    SpanHandle,
    SpanOptions,
} from "./types";
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

export class ProfilerRuntime implements ProfilerRuntimeLike {
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
    private readonly _fragmentAggregates = new Map<string, AggregateState>();
    private readonly _metrics = new Map<string, RuntimeMetric>();
    private readonly _fragmentMetrics = new Map<string, RuntimeMetric>();
    private readonly _errors: ProfilerError[] = [];
    private _idSequence = 0;
    private _stopped = false;
    private _overheadMs = 0;
    private _sampler?: NodeJS.Timeout;
    private _lastElu?: ReturnType<typeof performance.eventLoopUtilization>;
    private readonly _transferredOperationIds = new Set<string>();
    private _transferredErrorCount = 0;
    private readonly _externalTruncation = new Map<string, RuntimeSnapshot["truncation"][number]>();
    private readonly _asyncActivity?: AsyncActivityTracker;
    private _eventLoopDelay?: IntervalHistogram;
    private _lastHostCpu?: { busy: number; total: number };
    private _maxClockUncertaintyMs = 0;
    private _unalignedFragments = 0;
    private _aggregateIdentitiesSeen = 0;
    private _aggregateIdentityOverflow = 0;
    private _metricIdentitiesSeen = 0;
    private _metricIdentityOverflow = 0;
    private _fragmentSequence = 0;
    private readonly _clockUncertaintyMs?: number;

    constructor(options: {
        runId: string;
        level: EnabledProfilerLevel;
        process?: ProcessRef;
        clock?: ProfilerClock;
        /** High-resolution monotonic clock value to use as offset `0`. */
        originMonotonicMs?: number;
        /** Unix timestamp in milliseconds that corresponds to `originMonotonicMs`. */
        originEpochMs?: number;
        /** Estimated maximum error when this runtime clock is aligned with another process. */
        clockUncertaintyMs?: number;
    }) {
        this.runId = options.runId;
        this.level = options.level;
        this._clock = options.clock ?? systemClock;
        this._process = options.process ?? { type: "master", pid: process.pid };
        this._operationIdPrefix = operationIdPrefix(this.runId, this._process);
        this.originMonotonicMs = options.originMonotonicMs ?? this._clock.now();
        this.originEpochMs =
            options.originEpochMs ?? this._clock.epochNow() - (this._clock.now() - this.originMonotonicMs);
        this._clockUncertaintyMs = options.clockUncertaintyMs;

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
                ...this._externalTruncation.values(),
            ],
            overheadMs: this._overheadMs,
            clock: {
                maxUncertaintyMs: this._maxClockUncertaintyMs || undefined,
                unalignedFragments: this._unalignedFragments,
            },
        };
    }

    takeFragment(): ProfilerFragment | null {
        const snapshot = this.snapshot();
        const retainedOperationIds = new Set(snapshot.operations.map(operation => operation.id));
        for (const operationId of this._transferredOperationIds) {
            if (!retainedOperationIds.has(operationId)) {
                this._transferredOperationIds.delete(operationId);
            }
        }
        const operations = snapshot.operations.filter(operation => {
            if (this._transferredOperationIds.has(operation.id)) {
                return false;
            }
            this._transferredOperationIds.add(operation.id);
            return true;
        });
        const errors = snapshot.errors.slice(this._transferredErrorCount);
        this._transferredErrorCount = snapshot.errors.length;
        const aggregates = this._snapshotAggregates(this._fragmentAggregates);
        const metrics = [...this._fragmentMetrics.values()];
        this._fragmentAggregates.clear();
        this._fragmentMetrics.clear();

        if (!operations.length && !aggregates.length && !metrics.length && !errors.length) {
            return null;
        }

        return {
            transportVersion: 1,
            sequence: ++this._fragmentSequence,
            sourceRunId: this.runId,
            level: this.level,
            originEpochMs: snapshot.originEpochMs,
            clockUncertaintyMs: this._clockUncertaintyMs,
            process: this._process,
            operations,
            aggregates,
            metrics,
            errors,
            truncation: snapshot.truncation,
        };
    }

    ingestFragment(fragment: unknown): void {
        if (!this.isEnabled()) {
            return;
        }
        if (!isProfilerFragmentV1(fragment)) {
            const transportVersion = readTransportVersion(fragment);
            if (transportVersion !== 1) {
                this.recordError(
                    "transport.version",
                    new Error(`Unsupported profiler transport version ${safeString(transportVersion)}`),
                );
            } else {
                this.recordError("transport.fragment", new Error("Invalid profiler fragment payload"));
            }
            return;
        }
        if (!this._hasMatchingFragmentLevel(fragment)) {
            return;
        }

        const sourceKey = fragmentSourceKey(fragment);
        let ownedFragment: ProfilerFragment;
        try {
            ownedFragment = cloneProfilerFragment(fragment);
        } catch (error) {
            this.recordError("transport.fragment", error);
            return;
        }
        this._applyFragmentSafely(sourceKey, ownedFragment, ownedFragment.sequence);
    }

    private _applyFragmentSafely(sourceKey: string, fragment: ProfilerFragment, expectedSequence: number): void {
        if (!isProfilerFragmentV1(fragment)) {
            this.recordError("transport.fragment", new Error("Invalid profiler fragment payload"));
            return;
        }
        if (!this._hasMatchingFragmentLevel(fragment)) {
            return;
        }
        if (fragment.sequence !== expectedSequence || fragmentSourceKey(fragment) !== sourceKey) {
            this.recordError("transport.fragment", new Error("Profiler fragment identity changed before application"));
            return;
        }
        try {
            this._applyIngestedFragment(sourceKey, fragment);
        } catch (error) {
            this.recordError("transport.fragment", error);
        }
    }

    private _hasMatchingFragmentLevel(fragment: ProfilerFragment): boolean {
        if (fragment.level === this.level) {
            return true;
        }
        this.recordError(
            "transport.level",
            new Error(`Profiler fragment level ${fragment.level} does not match master level ${this.level}`),
        );
        return false;
    }

    private _applyIngestedFragment(sourceKey: string, fragment: ProfilerFragment): void {
        const epochOffsetMs = fragment.originEpochMs === undefined ? 0 : fragment.originEpochMs - this.originEpochMs;
        const hasAlignedClock = fragment.originEpochMs !== undefined && Number.isFinite(epochOffsetMs);
        if (!hasAlignedClock) {
            this._unalignedFragments += 1;
        } else {
            this._maxClockUncertaintyMs = Math.max(this._maxClockUncertaintyMs, fragment.clockUncertaintyMs ?? 5);
        }
        const operations: RetainedOperation[] = [];
        for (const sourceOperation of fragment.operations) {
            if (!isRetainedOperation(sourceOperation)) {
                this.recordError("transport.operation", new Error("Dropped invalid profiler operation"));
                continue;
            }
            const adjustedStartOffsetMs = (hasAlignedClock ? epochOffsetMs : 0) + sourceOperation.startOffsetMs;
            if (!Number.isFinite(adjustedStartOffsetMs)) {
                this.recordError(
                    "transport.operation",
                    new Error("Dropped profiler operation with invalid start offset"),
                );
                continue;
            }
            const process = sourceOperation.process.type === "browser" ? sourceOperation.process : fragment.process;
            const operation = copyDataRecord<RetainedOperation>(sourceOperation, {
                process,
                context: copyDataRecord(sourceOperation.context, { runId: this.runId }),
                startOffsetMs: Math.max(0, adjustedStartOffsetMs),
            });
            operations.push(operation);
        }

        // Local spans close child-first. Preserve that order after transport snapshots,
        // which are sorted by start time, so bounded retention can pin a parent on arrival.
        for (const operation of orderChildrenBeforeParents(operations)) {
            if (!fragment.aggregates?.length) {
                this._recordOperation(operation);
            } else {
                this._operations.add(operation);
            }
        }

        for (const aggregate of fragment.aggregates ?? []) {
            if (
                !this._mergeAggregate(
                    this._aggregates,
                    aggregate.kind,
                    aggregate.name,
                    aggregate.statistics,
                    aggregate.attributes,
                )
            ) {
                this.recordError("transport.aggregate", new Error(`Dropped overflowing aggregate ${aggregate.kind}`));
            }
        }
        for (const metric of fragment.metrics ?? []) {
            this._updateMetric(metric.name, metric.value, metric.dimensions, metric.mode === "counter", false);
        }
        for (const truncation of fragment.truncation) {
            const key = `${sourceKey}\0${truncation.collector}`;
            this._externalTruncation.set(key, { ...truncation });
        }

        for (const error of fragment.errors) {
            this.recordError(`worker.${error.stage}`, error);
        }
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
        this._addAggregate(this._fragmentAggregates, kind, name, value, false, attributes);
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

    private _mergeAggregate(
        store: Map<string, AggregateState>,
        kind: string,
        name: string,
        statistics: RuntimeAggregate["statistics"],
        attributes?: Record<string, ProfilerValue>,
    ): boolean {
        return this._updateAggregate(store, kind, name, attributes, true, current => current.merge(statistics));
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
        trackFragment = true,
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
        let key = `${normalizedMetric}\0${stableAttributesKey(normalizedDimensions)}`;
        const isNewIdentity = !this._metrics.has(key);
        let overflowed = false;
        if (isNewIdentity) {
            if (this._metrics.size >= RETENTION_POLICY_V1.maxAggregateIdentities - 1) {
                overflowed = true;
                normalizedMetric = "profiler.metric.other";
                normalizedDimensions = Object.create(null) as Record<string, ProfilerValue>;
                key = `${normalizedMetric}\0{}`;
            }
        }
        const current = this._metrics.get(key);
        const nextValue = increment ? (current?.value ?? 0) + value : value;
        const fragmentCurrent = trackFragment ? this._fragmentMetrics.get(key) : undefined;
        const nextFragmentValue = increment ? (fragmentCurrent?.value ?? 0) + value : value;
        if (!Number.isFinite(nextValue) || (trackFragment && !Number.isFinite(nextFragmentValue))) {
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
        if (trackFragment) {
            this._fragmentMetrics.set(key, {
                name: normalizedMetric,
                value: nextFragmentValue,
                dimensions: normalizedDimensions,
                mode: increment ? "counter" : "gauge",
            });
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

function fragmentSourceKey(fragment: ProfilerFragment): string {
    const process = readOwnDataProperty(fragment, "process") as ProcessRef;
    return [
        readOwnDataProperty(fragment, "sourceRunId") as string,
        readOwnDataProperty(process, "type") as ProcessRef["type"],
        readOwnDataProperty(process, "pid") as number | undefined,
        readOwnDataProperty(process, "workerInstanceId") as string | undefined,
        readOwnDataProperty(process, "browserId") as string | undefined,
    ]
        .map(keyPart)
        .join("|");
}

function stableAttributesKey(attributes?: Record<string, ProfilerValue>): string {
    if (!attributes) {
        return "";
    }

    return stringifyDataValue(
        copyEntriesToDataRecord(Object.entries(attributes).sort(([left], [right]) => left.localeCompare(right))),
    );
}

function cloneProfilerFragment(fragment: ProfilerFragment): ProfilerFragment {
    const normalized = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(fragment)) {
        if (key !== "operations") {
            normalized[key] = normalizeDataValue(readOwnDataProperty(fragment, key));
        }
    }
    const operations = readOwnDataProperty(fragment, "operations") as unknown[];
    const operationsLength = readOwnDataProperty(operations, "length") as number;
    const normalizedOperations = new Array<unknown>(operationsLength);
    for (let index = 0; index < operations.length; index += 1) {
        const operation = readOwnDataProperty(operations, String(index));
        // Invalid operations are still dropped individually when the fragment is applied.
        normalizedOperations[index] = isRetainedOperation(operation) ? normalizeDataValue(operation) : null;
    }
    normalized.operations = normalizedOperations;

    const cloned = structuredClone(normalized);
    if (!isProfilerFragmentV1(cloned)) {
        throw new Error("Cloned profiler fragment failed validation");
    }
    return normalizeDataValue(cloned) as ProfilerFragment;
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

function keyPart(value: string | number | undefined): string {
    if (value === undefined) {
        return "u";
    }
    return typeof value === "number" ? `n${value}` : `s${value.length}:${value}`;
}

function orderChildrenBeforeParents(operations: RetainedOperation[]): RetainedOperation[] {
    const byId = new Map(operations.map(operation => [operation.id, operation]));
    const children = new Map<string, RetainedOperation[]>();
    for (const operation of operations) {
        if (!operation.parentId || !byId.has(operation.parentId)) {
            continue;
        }
        const siblings = children.get(operation.parentId) ?? [];
        siblings.push(operation);
        children.set(operation.parentId, siblings);
    }

    const ordered: RetainedOperation[] = [];
    const visited = new Set<string>();
    const visit = (operation: RetainedOperation): void => {
        if (visited.has(operation.id)) {
            return;
        }
        visited.add(operation.id);
        for (const child of children.get(operation.id) ?? []) {
            visit(child);
        }
        ordered.push(operation);
    };

    operations.forEach(visit);
    return ordered;
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

type ValueGuard<T = unknown> = (value: unknown) => value is T;

const isProcessRef = recordShape<ProcessRef>({
    type: oneOf("master", "worker", "browser"),
    pid: optional(isPositiveSafeInteger),
    workerInstanceId: optional(isString),
    browserId: optional(isString),
});
const isOperationTiming = recordShape<RetainedOperation["timing"]>({
    wallMs: isNonNegativeFiniteNumber,
    selfWallMs: optional(isNonNegativeFiniteNumber),
    cumulativeWorkMs: optional(isNonNegativeFiniteNumber),
    overlapMs: optional(isNonNegativeFiniteNumber),
    criticalPathMs: optional(isNonNegativeFiniteNumber),
    observedChildUnionMs: optional(isNonNegativeFiniteNumber),
    processCpuMs: optional(isNonNegativeFiniteNumber),
    threadCpuMs: optional(isNonNegativeFiniteNumber),
    activeJsMs: optional(isNonNegativeFiniteNumber),
    waitingMs: optional(isNonNegativeFiniteNumber),
    eventLoopUtilization: optional(isUnitInterval),
});
const isCorrelationContext = recordShape<CorrelationContext>({
    runId: optional(isString),
    spanId: optional(isString),
    testId: optional(isString),
    attemptId: optional(isString),
    attempt: optional(isNonNegativeSafeInteger),
    browserId: optional(isString),
    sessionId: optional(isString),
    runnableKind: optional(isString),
});
const isSourceRef = recordShape<NonNullable<RetainedOperation["source"]>>({
    file: optional(isString),
    line: optional(isFiniteNumber),
    column: optional(isFiniteNumber),
    functionName: optional(isString),
    plugin: optional(isString),
    confidence: oneOf("high", "medium", "low"),
});
const isMeasurementQuality = recordShape<MeasurementQuality>({
    timing: oneOf("exact", "estimated", "sampled"),
    cpu: oneOf("process-window", "thread", "sampled", "unavailable"),
    source: optional(oneOf("exact", "partial", "unavailable")),
    notes: optional(arrayOf(isString)),
});
const retainedOperationGuard = recordShape<RetainedOperation>({
    id: isString,
    parentId: optional(isString),
    kind: isString,
    name: isString,
    process: isProcessRef,
    context: isCorrelationContext,
    startOffsetMs: isNonNegativeFiniteNumber,
    timing: isOperationTiming,
    source: optional(isSourceRef),
    attributes: isProfilerValueRecord,
    quality: isMeasurementQuality,
    status: optional(oneOf("completed", "failed", "interrupted")),
});
const statisticsSnapshotGuard = recordShape<StatisticsSnapshot>({
    count: isNonNegativeSafeInteger,
    sum: isFiniteNumber,
    min: isFiniteNumber,
    max: isFiniteNumber,
    mean: isFiniteNumber,
    variance: isFiniteNumber,
    p50: optional(isFiniteNumber),
    p95: optional(isFiniteNumber),
    samples: optional(arrayOf(isFiniteNumber)),
});
const isRuntimeAggregate = recordShape<RuntimeAggregate>({
    kind: isString,
    name: isString,
    attributes: optional(isProfilerValueRecord),
    statistics: isStatisticsSnapshot,
});
const isRuntimeMetric = recordShape<RuntimeMetric>({
    name: isString,
    value: isFiniteNumber,
    dimensions: isProfilerValueRecord,
    mode: oneOf("counter", "gauge"),
});
const isProfilerError = recordShape<ProfilerError>({
    stage: isString,
    code: optional(isString),
    message: isString,
});
const truncationEntryGuard = recordShape<TruncationEntry>({
    collector: isString,
    seen: isNonNegativeSafeInteger,
    retained: isNonNegativeSafeInteger,
    rule: isString,
    truncated: isBoolean,
});
const profilerFragmentGuard = recordShape<ProfilerFragment>({
    transportVersion: oneOf(1),
    sequence: isPositiveSafeInteger,
    sourceRunId: isString,
    level: oneOf(1, 2, 3),
    originEpochMs: optional(isFiniteNumber),
    clockUncertaintyMs: optional(isNonNegativeFiniteNumber),
    process: isProcessRef,
    operations: isDataArray,
    aggregates: optional(arrayOf(isRuntimeAggregate)),
    metrics: optional(arrayOf(isRuntimeMetric)),
    errors: arrayOf(isProfilerError),
    truncation: arrayOf(isTruncationEntry),
});

function isRetainedOperation(value: unknown): value is RetainedOperation {
    try {
        return retainedOperationGuard(value);
    } catch {
        return false;
    }
}

function isProfilerFragmentV1(value: unknown): value is ProfilerFragment {
    try {
        return profilerFragmentGuard(value);
    } catch {
        return false;
    }
}

function isStatisticsSnapshot(value: unknown): value is StatisticsSnapshot {
    if (!statisticsSnapshotGuard(value)) {
        return false;
    }
    const count = readOwnDataProperty(value, "count") as number;
    const sum = readOwnDataProperty(value, "sum") as number;
    const min = readOwnDataProperty(value, "min") as number;
    const max = readOwnDataProperty(value, "max") as number;
    const mean = readOwnDataProperty(value, "mean") as number;
    const variance = readOwnDataProperty(value, "variance") as number;
    const p50 = readOwnDataProperty(value, "p50") as number | undefined;
    const p95 = readOwnDataProperty(value, "p95") as number | undefined;
    const samples = (readOwnDataProperty(value, "samples") as number[] | undefined) ?? [];
    if (!count) {
        return (
            sum === 0 &&
            min === 0 &&
            max === 0 &&
            mean === 0 &&
            variance === 0 &&
            p50 === undefined &&
            p95 === undefined &&
            !samples.length
        );
    }
    if (
        sum < 0 ||
        min < 0 ||
        min > mean ||
        mean > max ||
        variance < 0 ||
        samples.length > count ||
        samples.length > DEFAULT_STATISTICS_RESERVOIR_SIZE ||
        ((count === 1 || min === max) && variance !== 0)
    ) {
        return false;
    }
    const lowerSum = min * count;
    const upperSum = max * count;
    if (!Number.isFinite(lowerSum) || !Number.isFinite(upperSum)) {
        return false;
    }
    const tolerance = Math.max(1, Math.abs(sum), Math.abs(lowerSum), Math.abs(upperSum)) * 1e-9;
    const expectedMean = sum / count;
    const meanTolerance = Math.max(1, Math.abs(mean), Math.abs(expectedMean)) * 1e-9;
    if (sum < lowerSum - tolerance || sum > upperSum + tolerance || Math.abs(mean - expectedMean) > meanTolerance) {
        return false;
    }
    const m2 = variance * (count - 1);
    if (!Number.isFinite(m2)) {
        return false;
    }
    const maxM2 = count * (mean - min) * (max - mean);
    if (Number.isFinite(maxM2)) {
        const m2Tolerance = Math.max(1, Math.abs(m2), Math.abs(maxM2)) * 1e-9;
        if (m2 > maxM2 + m2Tolerance) {
            return false;
        }
    }
    const inRange = (entry: number | undefined): boolean => entry === undefined || (entry >= min && entry <= max);
    if (!inRange(p50) || !inRange(p95) || (p50 !== undefined && p95 !== undefined && p50 > p95)) {
        return false;
    }
    for (let index = 0; index < samples.length; index += 1) {
        if (!inRange(samples[index]) || (index > 0 && samples[index - 1] > samples[index])) {
            return false;
        }
    }
    if (!samples.length) {
        return p50 === undefined && p95 === undefined;
    }
    if (p50 !== sampleQuantile(samples, 0.5) || p95 !== sampleQuantile(samples, 0.95)) {
        return false;
    }
    if (samples.length === count) {
        const completeStatistics = new StreamingStatistics(DEFAULT_STATISTICS_RESERVOIR_SIZE, () => 0);
        for (const sample of samples) {
            if (!completeStatistics.add(sample)) {
                return false;
            }
        }
        const completeSnapshot = completeStatistics.snapshot();
        return (
            min === completeSnapshot.min &&
            max === completeSnapshot.max &&
            approximatelyEqual(sum, completeSnapshot.sum) &&
            approximatelyEqual(mean, completeSnapshot.mean) &&
            approximatelyEqual(variance, completeSnapshot.variance)
        );
    }
    return true;
}

function isTruncationEntry(value: unknown): value is TruncationEntry {
    return (
        truncationEntryGuard(value) &&
        (readOwnDataProperty(value, "retained") as number) <= (readOwnDataProperty(value, "seen") as number)
    );
}

function readTransportVersion(value: unknown): unknown {
    try {
        if (!value || typeof value !== "object" || isProxy(value)) {
            return;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, "transportVersion");
        return descriptor && "value" in descriptor ? descriptor.value : undefined;
    } catch {
        return;
    }
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

function isProfilerValueRecord(value: unknown): value is Record<string, ProfilerValue> {
    return isPlainRecord(value) && Object.keys(value).every(key => isProfilerValue(readOwnDataProperty(value, key)));
}

function isProfilerValue(value: unknown): value is ProfilerValue {
    return value === null || typeof value === "string" || typeof value === "boolean" || isFiniteNumber(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value) || isProxy(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return (prototype === Object.prototype || prototype === null) && hasOnlyDataProperties(value, true);
}

function recordShape<T>(fields: Record<string, ValueGuard>): ValueGuard<T> {
    const entries = Object.entries(fields);
    const allowed = new Set(Object.keys(fields));

    return (value): value is T =>
        isPlainRecord(value) &&
        Object.keys(value).every(key => allowed.has(key)) &&
        entries.every(([key, guard]) => guard(readOwnDataProperty(value, key)));
}

function optional<T>(guard: ValueGuard<T>): ValueGuard<T | undefined> {
    return (value): value is T | undefined => value === undefined || guard(value);
}

function oneOf<T>(...allowed: T[]): ValueGuard<T> {
    return (value): value is T => allowed.includes(value as T);
}

function arrayOf<T>(guard: ValueGuard<T>): ValueGuard<T[]> {
    return (value): value is T[] => isDataArray(value) && Array.prototype.every.call(value, guard);
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean";
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
    return isFiniteNumber(value) && value >= 0;
}

function isUnitInterval(value: unknown): value is number {
    return isNonNegativeFiniteNumber(value) && value <= 1;
}

function isPositiveSafeInteger(value: unknown): value is number {
    return isFiniteNumber(value) && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
    return isFiniteNumber(value) && Number.isSafeInteger(value) && value >= 0;
}

function isDataArray(value: unknown): value is unknown[] {
    if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) {
        return false;
    }
    const keys = Reflect.ownKeys(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
        !lengthDescriptor ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        !lengthDescriptor.writable ||
        lengthDescriptor.enumerable ||
        lengthDescriptor.configurable
    ) {
        return false;
    }
    const length = lengthDescriptor.value;
    return (
        keys.length === length + 1 &&
        keys.every((key, index) => {
            const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
            return index === length
                ? key === "length" &&
                      "value" in descriptor &&
                      descriptor.value === length &&
                      descriptor.writable &&
                      !descriptor.enumerable &&
                      !descriptor.configurable
                : key === String(index) &&
                      "value" in descriptor &&
                      descriptor.writable &&
                      descriptor.enumerable &&
                      descriptor.configurable;
        })
    );
}

function hasOnlyDataProperties(value: object, enumerable = false): boolean {
    return Reflect.ownKeys(value).every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        return "value" in descriptor && (!enumerable || (typeof key === "string" && descriptor.enumerable));
    });
}

function readOwnDataProperty(value: unknown, key: PropertyKey): unknown {
    if (!value || (typeof value !== "object" && typeof value !== "function") || isProxy(value)) {
        return;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function sampleQuantile(values: number[], percentile: number): number | undefined {
    if (!values.length) {
        return;
    }
    return values[Math.min(values.length - 1, Math.floor((values.length - 1) * percentile))];
}

function approximatelyEqual(left: number, right: number): boolean {
    const tolerance = Math.max(1, Math.abs(left), Math.abs(right)) * 1e-9;
    return Math.abs(left - right) <= tolerance;
}
