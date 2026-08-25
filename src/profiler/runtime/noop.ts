import type { CorrelationContext, EnabledProfilerLevel, ProfilerValue } from "../schema";
import type { ProfilerFragment, ProfilerRuntimeLike, RuntimeSnapshot, SpanHandle, SpanOptions } from "./types";

/* eslint-disable @typescript-eslint/no-unused-vars -- method parameters document the no-op interface */

const NOOP_SPAN: SpanHandle = Object.freeze({ end: () => undefined });

class NoopProfilerRuntime implements ProfilerRuntimeLike {
    readonly level = 0;

    isEnabled(_minLevel: EnabledProfilerLevel = 1): boolean {
        return false;
    }

    startSpan(_kind: string, _options?: SpanOptions): SpanHandle {
        return NOOP_SPAN;
    }

    withSpan<T>(_kind: string, _options: SpanOptions, action: () => T): T {
        return action();
    }

    withContext<T>(_context: Partial<CorrelationContext>, action: () => T): T {
        return action();
    }

    increment(_metric: string, _value?: number, _dimensions?: Record<string, ProfilerValue>): void {}

    sample(_metric: string, _value: number, _dimensions?: Record<string, ProfilerValue>): void {}

    recordError(_stage: string, _error: unknown): void {}

    recordMeasurement(
        _kind: string,
        _durationMs: number,
        _options?: SpanOptions,
        _status?: "completed" | "failed" | "interrupted",
    ): void {}

    snapshot(): RuntimeSnapshot | null {
        return null;
    }

    closeOpenSpans(): void {}

    stop(): void {}

    takeFragment(): ProfilerFragment | null {
        return null;
    }

    ingestFragment(_fragment: unknown): void {}
}

export const noopProfilerRuntime = Object.freeze(new NoopProfilerRuntime());
