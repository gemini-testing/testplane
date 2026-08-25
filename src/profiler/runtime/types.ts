import type {
    CorrelationContext,
    EnabledProfilerLevel,
    MeasurementQuality,
    ProcessRef,
    ProfilerError,
    ProfilerValue,
    RetainedOperation,
    SourceRef,
    TruncationEntry,
} from "../schema";
import type { StatisticsSnapshot } from "../retention/streaming-statistics";

export interface SpanOptions {
    name?: string;
    /** Lowest enabled profiler level that records this span. */
    minLevel?: EnabledProfilerLevel;
    /** Identifier of the direct parent operation, when automatic context linking is not used. */
    parentId?: string;
    context?: Partial<CorrelationContext>;
    process?: ProcessRef;
    source?: SourceRef;
    attributes?: Record<string, ProfilerValue>;
    quality?: Partial<MeasurementQuality>;
}

export interface SpanHandle {
    readonly id?: string;
    end(status?: "completed" | "failed" | "interrupted"): void;
}

export interface RuntimeMetric {
    name: string;
    value: number;
    dimensions: Record<string, ProfilerValue>;
    /** `counter` values are added together; a `gauge` keeps the latest recorded value. */
    mode: "counter" | "gauge";
}

export interface RuntimeAggregate {
    kind: string;
    name: string;
    attributes?: Record<string, ProfilerValue>;
    statistics: StatisticsSnapshot;
}

export interface RuntimeSnapshot {
    runId: string;
    level: EnabledProfilerLevel;
    /** Unix timestamp in milliseconds that corresponds to offset `0` in this runtime. */
    originEpochMs: number;
    operations: RetainedOperation[];
    aggregates: RuntimeAggregate[];
    metrics: RuntimeMetric[];
    errors: ProfilerError[];
    truncation: TruncationEntry[];
    /** Sum of time measured inside span-start and span-end bookkeeping. */
    overheadMs: number;
    clock: {
        /** Largest estimated clock-alignment error among merged process fragments. */
        maxUncertaintyMs?: number;
        /** Number of fragments placed at offset `0` because their clocks could not be aligned. */
        unalignedFragments: number;
    };
}

export interface ProfilerFragment {
    /** Version of the process-to-process profiler transport format. */
    transportVersion: 1;
    /** Increasing fragment number within one `sourceRunId`; used to restore delivery order. */
    sequence: number;
    /** Identifier of the profiler runtime that produced this fragment. */
    sourceRunId: string;
    level: EnabledProfilerLevel;
    /** Unix timestamp in milliseconds that corresponds to offset `0` in the source runtime. */
    originEpochMs: number;
    /** Estimated maximum error when the source clock is aligned with the receiving runtime. */
    clockUncertaintyMs?: number;
    process: ProcessRef;
    operations: RetainedOperation[];
    aggregates?: RuntimeAggregate[];
    metrics?: RuntimeMetric[];
    errors: ProfilerError[];
    truncation: TruncationEntry[];
}

export interface ProfilerRuntimeLike {
    readonly level: 0 | EnabledProfilerLevel;
    readonly runId?: string;
    isEnabled(minLevel?: EnabledProfilerLevel): boolean;
    startSpan(kind: string, options?: SpanOptions): SpanHandle;
    withSpan<T>(kind: string, options: SpanOptions, action: () => T): T;
    withContext<T>(context: Partial<CorrelationContext>, action: () => T): T;
    increment(metric: string, value?: number, dimensions?: Record<string, ProfilerValue>): void;
    sample(metric: string, value: number, dimensions?: Record<string, ProfilerValue>): void;
    recordError(stage: string, error: unknown): void;
    recordMeasurement(
        kind: string,
        /** Duration of the already completed operation in milliseconds. */
        durationMs: number,
        options?: SpanOptions,
        status?: "completed" | "failed" | "interrupted",
    ): void;
    snapshot(): RuntimeSnapshot | null;
    closeOpenSpans(): void;
    stop(): void;
    takeFragment(): ProfilerFragment | null;
    ingestFragment(fragment: unknown): void;
}
