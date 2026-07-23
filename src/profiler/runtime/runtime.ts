import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
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
import type { BootstrapProbe } from "./bootstrap-probe";
import { cpuUsageToMs, ProfilerClock, systemClock } from "./clock";
import type { RuntimeSnapshot, SpanHandle, SpanOptions } from "./types";
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

const DEFAULT_QUALITY: MeasurementQuality = {
    timing: "exact",
    cpu: "process-window",
};

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
    private readonly _errors: ProfilerError[] = [];
    private _idSequence = 0;
    private _stopped = false;
    private _overheadMs = 0;
    private readonly _asyncActivity?: AsyncActivityTracker;

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
        this._asyncActivity?.disable();
    }

    snapshot(): RuntimeSnapshot {
        const { operations, truncation } = this._operations.snapshot();

        return {
            runId: this.runId,
            level: this.level,
            originEpochMs: this.originEpochMs,
            operations,
            aggregates: [],
            metrics: [],
            errors: [...this._errors],
            truncation,
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

function isPromiseLike<T>(value: T): value is T & PromiseLike<Awaited<T>> {
    return Boolean(value && typeof (value as { then?: unknown }).then === "function");
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
