export type EnabledProfilerLevel = 1 | 2 | 3;

export type ProfilerOperationName = "run" | "readTests" | `cli:${string}` | "api";

export type ProfilerRunOutcome = "passed" | "failed" | "aborted" | "unknown";

export type ProfilerConfidence = "high" | "medium" | "low";

export type ProfilerValue = string | number | boolean | null;

export interface ProcessRef {
    /** Role of the process that recorded the operation. */
    type: "master" | "worker" | "browser";
    /** Operating-system process identifier, when it is available. */
    pid?: number;
    /** Testplane identifier that distinguishes worker instances, including restarted workers. */
    workerInstanceId?: string;
    /** Browser configuration name, such as `chrome` or `firefox`. */
    browserId?: string;
}

export interface ProfilerPartialReason {
    code: string;
    message: string;
}

export interface CorrelationContext {
    /** Internal runtime correlation only; omitted from the final single-run result. */
    runId?: string;
    /** Identifier of the operation that was active when this context was created. */
    spanId?: string;
    /** Stable identifier of the test across its retry attempts. */
    testId?: string;
    /** Identifier of one specific test attempt. */
    attemptId?: string;
    /** Zero-based retry attempt number. The first attempt is `0`. */
    attempt?: number;
    /** Browser configuration name associated with this operation. */
    browserId?: string;
    /** Identifier of the concrete browser session used by the operation. */
    sessionId?: string;
    /** Mocha runnable type, for example `test`, `beforeEach`, or `afterEach`. */
    runnableKind?: string;
}

export interface SourceRef {
    file?: string;
    line?: number;
    column?: number;
    functionName?: string;
    plugin?: string;
    /** How certain the profiler is that this source location caused the recorded operation. */
    confidence: ProfilerConfidence;
}

export interface MeasurementQuality {
    /** How the elapsed time was obtained: measured directly, calculated, or sampled. */
    timing: "exact" | "estimated" | "sampled";
    /** Scope and method of the CPU measurement. `process-window` may include unrelated concurrent work. */
    cpu: "process-window" | "thread" | "sampled" | "unavailable";
    /** How complete and reliable the optional source location is. */
    source?: "exact" | "partial" | "unavailable";
    /** Short explanations of known limits in this measurement. */
    notes?: string[];
}

export interface OperationTiming {
    /**
     * Elapsed time represented by this operation.
     * It includes every kind of activity or waiting during the interval; `quality.timing` says how it was obtained.
     */
    wallMs: number;
    /**
     * Part of `wallMs` left after subtracting the larger of two separately calculated durations:
     * elapsed time covered by retained direct children, or elapsed time covered by child spans seen while the parent was open.
     * A standalone child measurement removed by retention is in neither duration, so its time may remain here.
     */
    selfWallMs?: number;
    /**
     * Sum of `wallMs` for all retained direct child operations.
     * It can be greater than the parent `wallMs` when children overlap or run in parallel.
     */
    cumulativeWorkMs?: number;
    /**
     * Child work that happened at the same time as other retained direct child work.
     * It is the sum of child durations minus the elapsed time covered by their combined intervals.
     */
    overlapMs?: number;
    /**
     * Estimate of the longest dependent path through the retained operation tree.
     * It adds this operation's self time to its longest retained child path and never exceeds `wallMs`.
     */
    criticalPathMs?: number;
    /**
     * Combined elapsed time covered by direct child spans while the parent was open, before timeline retention.
     * It does not include standalone measurements that were recorded only after their duration was known.
     */
    observedChildUnionMs?: number;
    /**
     * CPU time used by the whole Node.js process while the operation was open.
     * Concurrent work in the same process may be included.
     */
    processCpuMs?: number;
    /** CPU time used by the current Node.js thread while the operation was open. */
    threadCpuMs?: number;
    /**
     * Best-effort time spent in JavaScript callbacks attributed to this operation by `async_hooks`.
     * Native work and activity that cannot be linked to the operation are not included.
     */
    activeJsMs?: number;
    /**
     * Part of `wallMs` not attributed to active JavaScript.
     * It may include I/O, scheduling waits, native work, and activity that could not be linked to the operation.
     */
    waitingMs?: number;
    /** Fraction from `0` to `1` showing how much of the interval the Node.js event loop was busy. */
    eventLoopUtilization?: number;
}

export interface RetainedOperation {
    id: string;
    parentId?: string;
    kind: string;
    name: string;
    process: ProcessRef;
    context: CorrelationContext;
    /** Elapsed time from the start of the profiled run to the start of this operation. */
    startOffsetMs: number;
    timing: OperationTiming;
    source?: SourceRef;
    attributes: Record<string, ProfilerValue>;
    quality: MeasurementQuality;
    /** Final state of the operation. `interrupted` means profiling stopped before normal completion. */
    status?: "completed" | "failed" | "interrupted";
}

export interface ProfilerAggregate {
    kind: string;
    name: string;
    /** Number of measurements included in this aggregate. */
    count: number;
    /**
     * Sum of all measurements. For timing aggregates this is the sum of elapsed durations.
     * Resource-sampling aggregates keep their native numeric unit despite the `WallMs` name.
     */
    totalWallMs: number;
    /** Smallest measurement. For timing aggregates the value is in milliseconds. */
    minWallMs: number;
    /** Largest measurement. For timing aggregates the value is in milliseconds. */
    maxWallMs: number;
    /** Arithmetic average. For timing aggregates the value is in milliseconds. */
    meanWallMs: number;
    /** Estimated median from a bounded random sample: about half of the values are at or below it. */
    p50WallMs?: number;
    /** Estimated 95th percentile from a bounded random sample: about 95% of the values are at or below it. */
    p95WallMs?: number;
    /**
     * Sum of measured work in the represented hierarchy. It normally equals `totalWallMs`.
     * The browser-command summary includes every nested command here while `totalWallMs` includes root commands only.
     */
    cumulativeWorkMs?: number;
    /**
     * `cumulativeWorkMs - totalWallMs` for the browser-command summary.
     * It shows additional nested-command work and is not a direct measurement of parallel execution.
     */
    overlapMs?: number;
    attributes?: Record<string, ProfilerValue>;
}

export interface ProfileAggregates {
    byKind: ProfilerAggregate[];
    phases: ProfilerAggregate[];
    listeners: ProfilerAggregate[];
    testFiles: ProfilerAggregate[];
    tests: ProfilerAggregate[];
    hooks: ProfilerAggregate[];
    commands: ProfilerAggregate[];
    workers: ProfilerAggregate[];
    browsers: ProfilerAggregate[];
    metrics: Array<{
        name: string;
        value: number;
        dimensions: Record<string, ProfilerValue>;
    }>;
}

export interface FindingEvidence {
    /** Stable machine-readable name of the measured fact. */
    metric: string;
    value: ProfilerValue;
    /** Unit of `value`, for example `ms`, `ratio`, or `count`. */
    unit?: string;
    /** Policy value that caused the analyzer to report this finding. */
    threshold?: ProfilerValue;
    /** Timeline operation that provides this evidence, when one exists. */
    operationId?: string;
}

export interface Finding {
    id: string;
    analyzer: {
        id: string;
        version: number;
    };
    category: string;
    severity: "warning";
    /** Plain-language description of what the analyzer observed. */
    observation: string;
    evidence: FindingEvidence[];
    /** Concrete next step that may improve the run. */
    action: string;
    /** Confidence in the finding and its suggested action, not in profiler execution success. */
    confidence: ProfilerConfidence;
    operationIds: string[];
    entityIds?: string[];
    confidenceReasons?: string[];
}

export interface ProfilerCapabilities {
    processCpu: "available" | "unavailable";
    threadCpu: "available" | "unavailable";
    eventLoop: "available" | "unavailable";
    asyncActivity: "available" | "unavailable" | "disabled";
    moduleGraph: "cjs" | "cjs-and-esm" | "unavailable" | "disabled";
    browserTelemetry: "available" | "partial" | "unavailable" | "disabled";
}

export interface ProfilerError {
    stage: string;
    code?: string;
    message: string;
}

export interface TruncationEntry {
    /** Collector or retention bucket whose data was limited. */
    collector: string;
    /** Total number of records offered to the retention policy. */
    seen: number;
    /** Number of records kept in the final profiler data. */
    retained: number;
    /** Short name of the retention rule that selected the records. */
    rule: string;
    /** Whether at least one offered record was not retained. */
    truncated: boolean;
}

export interface DataQuality {
    clock: {
        /** Largest estimated clock-alignment error among merged process fragments. */
        maxUncertaintyMs?: number;
        /** Number of fragments that could not be aligned to the main process timeline. */
        unalignedFragments: number;
    };
    coverage: Array<{
        collector: string;
        status: "complete" | "partial" | "unavailable";
        reason?: string;
    }>;
}

export interface EnvironmentSummary {
    node: string;
    platform: string;
    arch: string;
    /** Number of logical CPU execution slots reported by Node.js for this host. */
    availableParallelism: number;
    /** Worker count configured for this Testplane run. */
    configuredWorkers?: number;
    /** Configured maximum browser sessions, grouped by browser configuration name. */
    configuredSessionsPerBrowser?: Record<string, number>;
}

export interface ProfilerResultV1 {
    schemaVersion: 1;
    run: {
        id: string;
        level: EnabledProfilerLevel;
        operation: ProfilerOperationName;
        profileStatus: "complete" | "partial";
        runOutcome: ProfilerRunOutcome;
        /** ISO 8601 wall-clock time when profiling started. */
        startedAt: string;
        /** Real elapsed time of the complete profiled Testplane operation. */
        durationMs: number;
        partialReasons: ProfilerPartialReason[];
    };
    environment: EnvironmentSummary;
    capabilities: ProfilerCapabilities;
    timeline: RetainedOperation[];
    aggregates: ProfileAggregates;
    findings: Finding[];
    dataQuality: DataQuality;
    profiler: {
        collectionErrors: ProfilerError[];
        truncation: TruncationEntry[];
        /**
         * Sum of time measured inside span-start and span-end bookkeeping.
         * Sampling, fragment transport, final analysis, console rendering, and JSON writing are not included.
         */
        inRunOverheadEstimateMs?: number;
    };
}
