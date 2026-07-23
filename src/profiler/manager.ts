import os from "node:os";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import * as NodeModule from "node:module";
import type { Config } from "../config";
import { aggregateProfile } from "./analysis/aggregator";
import { runAnalyzers } from "./analysis/analyzers";
import { compactProfileReferences } from "./analysis/compact";
import { printProfilerResult, type ProfilerConsole } from "./output/console";
import { writeProfilerJson } from "./output/json";
import { BootstrapProbe } from "./runtime/bootstrap-probe";
import { noopProfilerRuntime } from "./runtime/noop";
import { ProfilerRuntime } from "./runtime/runtime";
import type { ProfilerRuntimeLike } from "./runtime/types";
import { ProfilerSanitizer } from "./sanitize";
import { enforceSerializedResultBudget } from "./retention/result-budget";
import { enforceSerializedTimelineBudget } from "./retention/serialized-budget";
import type {
    EnabledProfilerLevel,
    ProfilerOperationName,
    ProfilerPartialReason,
    ProfilerResultV1,
    ProfilerRunOutcome,
    ProcessRef,
} from "./schema";

interface ActiveOperation {
    name: ProfilerOperationName;
    outcome: ProfilerRunOutcome;
    partialReasons: ProfilerPartialReason[];
    startedAt: string;
    /** High-resolution monotonic clock value captured when the operation started. */
    originMonotonicMs: number;
}

interface ProfilerResultEmitter {
    (result: Readonly<ProfilerResultV1>): Promise<unknown> | unknown;
}

interface ProfilerManagerOptions {
    output?: ProfilerConsole;
    process?: ProcessRef;
    runId?: string;
    /** Amount added to local wall-clock timestamps to align them with the main process. */
    clockOffsetMs?: number;
    /** Estimated maximum error of the supplied clock alignment. */
    clockUncertaintyMs?: number;
}

export class ProfilerManager {
    private readonly _config: Config;
    private readonly _projectRoot: string;
    private _sanitizer?: ProfilerSanitizer;
    private readonly _console?: ProfilerConsole;
    private _probe?: BootstrapProbe;
    private _runtime?: ProfilerRuntime;
    private _active?: ActiveOperation;
    private _emitResult?: ProfilerResultEmitter;
    private _lastResult?: Readonly<ProfilerResultV1>;
    /** In-flight finalize; concurrent callers (SIGINT + profileOperation finally) share one result. */
    private _finalizePromise?: Promise<Readonly<ProfilerResultV1> | undefined>;
    private readonly _process: ProcessRef;
    private readonly _initialRunId?: string;
    private readonly _clockOffsetMs: number;
    private readonly _clockUncertaintyMs?: number;

    constructor(config: Config, probe: BootstrapProbe, options: ProfilerManagerOptions = {}) {
        this._config = config;
        this._projectRoot = process.cwd();
        this._probe = probe;
        this._console = options.output;
        this._process = options.process ?? { type: "master", pid: process.pid };
        this._initialRunId = options.runId;
        this._clockOffsetMs = options.clockOffsetMs ?? 0;
        this._clockUncertaintyMs = options.clockUncertaintyMs;

        if (this.isEnabled()) {
            this._createRuntime();
        } else {
            probe.discard();
        }
    }

    get runtime(): ProfilerRuntimeLike {
        return this._runtime ?? noopProfilerRuntime;
    }

    get lastResult(): Readonly<ProfilerResultV1> | undefined {
        return this._lastResult;
    }

    isEnabled(): boolean {
        return (this._config.profiler?.level ?? 0) > 0;
    }

    setResultEmitter(emitter: ProfilerResultEmitter): void {
        this._emitResult = emitter;
    }

    async profileOperation<T>(name: ProfilerOperationName, action: () => T | Promise<T>): Promise<T> {
        if (!this.isEnabled()) {
            return action();
        }

        if (this._active) {
            return action();
        }

        const active = this._activateOperation(name, "unknown");

        try {
            const result = await action();
            if (active.outcome !== "aborted") {
                active.outcome = typeof result === "boolean" && !result ? "failed" : "passed";
            }
            return result;
        } catch (error) {
            active.outcome = "aborted";
            active.partialReasons.push({
                code: "OPERATION_ERROR",
                message: this._getSanitizer().string(String((error as Error)?.message ?? error)),
            });
            throw error;
        } finally {
            await this.finalizeSafely();
        }
    }

    async finalizeSetupError(error: unknown): Promise<void> {
        if (!this.isEnabled()) {
            return;
        }

        this._activateOperation("api", "aborted", [
            {
                code: "INITIALIZATION_ERROR",
                message: this._getSanitizer().string(String((error as Error)?.message ?? error)),
            },
        ]);
        await this.finalizeSafely();
    }

    addPartialReason(reason: ProfilerPartialReason): void {
        this._active?.partialReasons.push(reason);
    }

    abort(reason: ProfilerPartialReason): void {
        if (!this._active) {
            return;
        }
        this._active.outcome = "aborted";
        if (
            !this._active.partialReasons.some(
                current => current.code === reason.code && current.message === reason.message,
            )
        ) {
            this._active.partialReasons.push(reason);
        }
    }

    sanitizeMessage(message: string): string {
        return this._getSanitizer().embedded(String(message)).slice(0, 1000);
    }

    async finalize(): Promise<Readonly<ProfilerResultV1> | undefined> {
        if (this._finalizePromise) {
            return this._finalizePromise;
        }
        const active = this._active;
        const runtime = this._runtime;
        if (!active || !runtime) {
            return this._lastResult;
        }

        // Assign synchronously so concurrent finalize()/finalizeSafely() join the same run.
        this._finalizePromise = this._finalizeOnce(active, runtime);
        try {
            return await this._finalizePromise;
        } finally {
            this._finalizePromise = undefined;
        }
    }

    async finalizeSafely(): Promise<void> {
        try {
            await this.finalize();
        } catch (error) {
            this._warnDelivery("profile finalization", error);
        }
    }

    private async _finalizeOnce(
        active: ActiveOperation,
        runtime: ProfilerRuntime,
    ): Promise<Readonly<ProfilerResultV1>> {
        try {
            runtime.stop();
            const result = this._buildResult(active, runtime);
            this._lastResult = result;

            await this._deliverResult(result);
            return result;
        } catch (error) {
            runtime.recordError("finalize", error);
            throw error;
        } finally {
            this._active = undefined;
            this._runtime = undefined;
            this._probe = undefined;
        }
    }

    private _buildResult(active: ActiveOperation, runtime: ProfilerRuntime): Readonly<ProfilerResultV1> {
        const durationMs = Math.max(0, performance.now() - active.originMonotonicMs);
        const normalized = aggregateProfile(runtime.snapshot(), durationMs, active.name);
        const compact = compactProfileReferences(normalized.timeline, runAnalyzers(normalized));
        const retained = enforceSerializedTimelineBudget(runtime.level, compact.timeline, compact.findings);
        const sanitizer = this._getSanitizer();
        const collectionErrors = normalized.errors.map(error =>
            sanitizer.error(error.stage, {
                ...error,
                message: error.message.replaceAll(`${runtime.runId}:`, ""),
            }),
        );
        const partialReasons = [...active.partialReasons];
        if (collectionErrors.length) {
            partialReasons.push({
                code: "PROFILER_COLLECTION_ERROR",
                message: `${collectionErrors.length} profiler collection or analysis error(s) occurred`,
            });
        }

        const sanitized = sanitizer.sanitizeResult({
            schemaVersion: 1,
            run: {
                id: runtime.runId,
                level: runtime.level,
                operation: active.name,
                profileStatus: partialReasons.length ? "partial" : "complete",
                runOutcome: active.outcome,
                startedAt: active.startedAt,
                durationMs,
                partialReasons,
            },
            environment: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                availableParallelism: getAvailableParallelism(),
                configuredWorkers: this._config.system.workers,
                configuredSessionsPerBrowser: Object.fromEntries(
                    this._config
                        .getBrowserIds()
                        .map(browserId => [browserId, this._config.forBrowser(browserId).sessionsPerBrowser]),
                ),
            },
            capabilities: capabilities(runtime.level),
            timeline: retained.timeline,
            aggregates: normalized.aggregates,
            findings: compact.findings,
            dataQuality: {
                clock: normalized.clock,
                coverage: defaultCoverage(runtime.level),
            },
            profiler: {
                collectionErrors,
                truncation: [...normalized.truncation, ...(retained.truncation ? [retained.truncation] : [])],
                inRunOverheadEstimateMs: normalized.overheadMs,
            },
        });
        return sanitizer.freezeResult(enforceSerializedResultBudget(runtime.level, sanitized));
    }

    private async _deliverResult(result: Readonly<ProfilerResultV1>): Promise<void> {
        try {
            printProfilerResult(result, this._console);
        } catch (error) {
            this._warnDelivery("console", error);
        }

        const deliveries: Promise<unknown>[] = [];
        if (this._emitResult) {
            deliveries.push(Promise.resolve().then(() => this._emitResult?.(result)));
        }
        if (this._config.profiler?.output) {
            deliveries.push(writeProfilerJson(this._config.profiler.output, result));
        }

        const deliveryResults = await Promise.allSettled(deliveries);
        for (const delivery of deliveryResults) {
            if (delivery.status === "rejected") {
                this._warnDelivery("result", delivery.reason);
            }
        }
    }

    private _ensureRuntime(): ProfilerRuntime {
        return this._runtime ?? this._createRuntime();
    }

    private _getSanitizer(): ProfilerSanitizer {
        this._sanitizer ??= new ProfilerSanitizer(this._projectRoot);
        return this._sanitizer;
    }

    private _createRuntime(): ProfilerRuntime {
        const level = this._config.profiler?.level as EnabledProfilerLevel;
        const runId = this._initialRunId ?? randomUUID();
        const originMonotonicMs = this._probe?.startedAtMonotonicMs ?? performance.now();
        const originEpochMs = (this._probe?.startedAtEpochMs ?? Date.now()) + this._clockOffsetMs;
        const runtime = new ProfilerRuntime({
            runId,
            level,
            originMonotonicMs,
            originEpochMs,
            clockUncertaintyMs: this._clockUncertaintyMs,
            process: this._process,
        });
        runtime.sample("config.workers", this._config.system.workers);
        runtime.sample("config.availableParallelism", getAvailableParallelism());
        for (const browserId of this._config.getBrowserIds()) {
            runtime.sample("config.sessionsPerBrowser", this._config.forBrowser(browserId).sessionsPerBrowser, {
                browserId,
            });
        }
        if (this._probe) {
            runtime.adoptBootstrapProbe(this._probe);
        }
        this._runtime = runtime;
        return runtime;
    }

    private _activateOperation(
        name: ProfilerOperationName,
        outcome: ProfilerRunOutcome,
        partialReasons: ProfilerPartialReason[] = [],
    ): ActiveOperation {
        const runtime = this._ensureRuntime();
        const active = {
            name,
            outcome,
            partialReasons,
            startedAt: this._probe?.startedAt ?? new Date().toISOString(),
            originMonotonicMs: runtime.originMonotonicMs,
        };
        this._active = active;
        return active;
    }

    private _warnDelivery(channel: string, error: unknown): void {
        const message = `[profiler] Failed to deliver ${channel}: ${this._getSanitizer().string(
            String((error as Error)?.message ?? error),
        )}`;
        if (this._console) {
            this._console.warn(message);
        } else {
            console.warn(message);
        }
    }
}

function capabilities(level: EnabledProfilerLevel): ProfilerResultV1["capabilities"] {
    return {
        processCpu: typeof process.cpuUsage === "function" ? "available" : "unavailable",
        threadCpu: typeof process.threadCpuUsage === "function" ? "available" : "unavailable",
        eventLoop: typeof performance.eventLoopUtilization === "function" ? "available" : "unavailable",
        asyncActivity: level >= 3 ? "available" : "disabled",
        moduleGraph: level >= 3 ? (typeof NodeModule.registerHooks === "function" ? "cjs-and-esm" : "cjs") : "disabled",
        browserTelemetry: level >= 3 ? "partial" : "disabled",
    };
}

type CoverageEntry = ProfilerResultV1["dataQuality"]["coverage"][number];

function defaultCoverage(level: EnabledProfilerLevel): ProfilerResultV1["dataQuality"]["coverage"] {
    return [
        { collector: "lifecycle", status: "complete" },
        { collector: "resources", status: "complete" },
        coverageAtLevel(level, "events", 2),
        coverageAtLevel(level, "testFiles", 2),
        coverageAtLevel(level, "testsAndHooks", 2),
        coverageAtLevel(level, "workersAndSessions", 2),
        coverageAtLevel(level, "commands", 3, {
            status: "partial",
            reason: "Only observed Testplane browser command boundaries are available",
        }),
        coverageAtLevel(level, "moduleGraph", 3, {
            status: "partial",
            reason: "CJS evaluation and ESM source-load boundaries are not equivalent",
        }),
        coverageAtLevel(level, "browserRuntime", 3, {
            status: "partial",
            reason: "Browser runnable/resource timing is available; browser CPU attribution is unavailable",
        }),
    ];
}

function coverageAtLevel(
    level: EnabledProfilerLevel,
    collector: string,
    requiredLevel: EnabledProfilerLevel,
    available: Omit<CoverageEntry, "collector"> = {
        status: "complete",
        reason: undefined,
    },
): CoverageEntry {
    return level >= requiredLevel
        ? { collector, ...available }
        : {
              collector,
              status: "unavailable",
              reason: `Requires level ${requiredLevel}`,
          };
}

function getAvailableParallelism(): number {
    return typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
}
