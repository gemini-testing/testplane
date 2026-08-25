import { cpuUsageToMs, ProfilerClock, systemClock } from "./clock";

interface BootstrapRecord {
    id: number;
    parentId?: number;
    kind: string;
    name: string;
    /** Monotonic clock value when the startup phase began. */
    startMs: number;
    /** Monotonic clock value when the startup phase ended. */
    endMs: number;
    /** CPU time used by the process while this startup phase was open. */
    processCpuMs: number;
    status: "completed" | "failed" | "interrupted";
}

interface BootstrapPhase {
    end(status?: BootstrapRecord["status"]): void;
}

interface OpenBootstrapPhase {
    id: number;
    parentId?: number;
    kind: string;
    name: string;
    /** Monotonic clock value captured when the startup phase began. */
    startMs: number;
    cpu: NodeJS.CpuUsage;
    ended: boolean;
}

const NOOP_BOOTSTRAP_PHASE: BootstrapPhase = Object.freeze({ end: () => undefined });

/**
 * Records the small part of startup that happens before profiler.level is known.
 * It deliberately uses only a bounded array and clock/CPU snapshots.
 */
export class BootstrapProbe {
    /** ISO 8601 wall-clock time when the bootstrap probe started. */
    readonly startedAt: string;
    /** Unix wall-clock timestamp in milliseconds when the probe started. */
    readonly startedAtEpochMs: number;
    /** High-resolution monotonic clock value used as the local timing origin. */
    readonly startedAtMonotonicMs: number;

    private readonly _clock: ProfilerClock;
    private readonly _records: BootstrapRecord[] = [];
    private readonly _open = new Set<OpenBootstrapPhase>();
    private readonly _stack: OpenBootstrapPhase[] = [];
    private _sequence = 0;
    private _discarded = false;

    constructor(clock: ProfilerClock = systemClock) {
        this._clock = clock;
        this.startedAtEpochMs = clock.epochNow();
        this.startedAtMonotonicMs = clock.now();
        this.startedAt = new Date(this.startedAtEpochMs).toISOString();
    }

    startPhase(kind: string, name: string = kind): BootstrapPhase {
        if (this._discarded) {
            return NOOP_BOOTSTRAP_PHASE;
        }

        const phase: OpenBootstrapPhase = {
            id: ++this._sequence,
            parentId: this._stack.at(-1)?.id,
            kind,
            name,
            startMs: this._clock.now(),
            cpu: this._clock.cpuUsage(),
            ended: false,
        };
        this._open.add(phase);
        this._stack.push(phase);

        return {
            end: (status = "completed"): void => this._finishPhase(phase, status),
        };
    }

    async withPhase<T>(kind: string, name: string, action: () => T | Promise<T>): Promise<T> {
        const phase = this.startPhase(kind, name);

        try {
            const result = await action();
            phase.end();
            return result;
        } catch (error) {
            phase.end("failed");
            throw error;
        }
    }

    takeRecords(): BootstrapRecord[] {
        if (this._discarded) {
            return [];
        }

        for (const phase of this._open) {
            this._finishPhase(phase, "interrupted");
        }

        return this._records.splice(0);
    }

    discard(): void {
        this._discarded = true;
        this._records.length = 0;
        this._open.clear();
        this._stack.length = 0;
    }

    private _finishPhase(phase: OpenBootstrapPhase, status: BootstrapRecord["status"]): void {
        if (phase.ended || this._discarded) {
            return;
        }

        phase.ended = true;
        this._open.delete(phase);
        const stackIndex = this._stack.lastIndexOf(phase);
        if (stackIndex >= 0) {
            this._stack.splice(stackIndex, 1);
        }
        this._records.push({
            id: phase.id,
            parentId: phase.parentId,
            kind: phase.kind,
            name: phase.name,
            startMs: phase.startMs,
            endMs: this._clock.now(),
            processCpuMs: cpuUsageToMs(this._clock.cpuUsage(phase.cpu)),
            status,
        });
    }
}
