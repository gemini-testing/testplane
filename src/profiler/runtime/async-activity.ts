import { createHook, executionAsyncId, type AsyncHook } from "node:async_hooks";
import type { ProfilerClock } from "./clock";

interface ActiveSegment {
    spanId: string;
    /** Monotonic clock value captured when this JavaScript callback began. */
    startedAt: number;
}

export class AsyncActivityTracker {
    private readonly _resourceSpans = new Map<number, string>();
    private readonly _activeSegments = new Map<number, ActiveSegment>();
    private readonly _activeMs = new Map<string, number>();
    private readonly _activeSpans = new Set<string>();
    private readonly _hook: AsyncHook;
    private _enabled = false;

    constructor(
        private readonly _clock: ProfilerClock,
        private readonly _currentSpanId: () => string | undefined,
        onError: (error: unknown) => void,
    ) {
        const safe = (action: () => void): void => {
            try {
                action();
            } catch (error) {
                try {
                    onError(error);
                } catch {
                    // async_hooks callbacks must never throw.
                }
            }
        };

        this._hook = createHook({
            init: asyncId =>
                safe(() => {
                    const spanId = this._currentSpanId();
                    if (spanId && this._activeSpans.has(spanId)) {
                        this._resourceSpans.set(asyncId, spanId);
                    }
                }),
            before: asyncId =>
                safe(() => {
                    const spanId = this._resourceSpans.get(asyncId);
                    if (spanId && this._activeSpans.has(spanId)) {
                        this._activeSegments.set(asyncId, { spanId, startedAt: this._clock.now() });
                    }
                }),
            after: asyncId => safe(() => this._finishSegment(asyncId)),
            destroy: asyncId => safe(() => this._deleteResource(asyncId)),
            promiseResolve: asyncId => safe(() => this._finishSegment(asyncId)),
        });
    }

    startSpan(spanId: string): void {
        if (!this._activeSpans.size) {
            this._hook.enable();
            this._enabled = true;
        }
        this._activeSpans.add(spanId);
    }

    measureSynchronous<T>(spanId: string | undefined, action: () => T): T {
        if (!spanId) {
            return action();
        }
        const startedAt = this._clock.now();
        try {
            return action();
        } finally {
            this._add(spanId, this._clock.now() - startedAt);
        }
    }

    finishSpan(spanId: string): number {
        let activeMs = this._activeMs.get(spanId) ?? 0;
        const current = this._activeSegments.get(executionAsyncId());
        if (current?.spanId === spanId) {
            activeMs += Math.max(0, this._clock.now() - current.startedAt);
            this._activeSegments.delete(executionAsyncId());
        }
        this._activeMs.delete(spanId);
        this._activeSpans.delete(spanId);
        if (!this._activeSpans.size) {
            this._hook.disable();
            this._enabled = false;
            this._resourceSpans.clear();
            this._activeSegments.clear();
        }
        return activeMs;
    }

    disable(): void {
        if (this._enabled) {
            this._hook.disable();
            this._enabled = false;
        }
        this._resourceSpans.clear();
        this._activeSegments.clear();
        this._activeMs.clear();
        this._activeSpans.clear();
    }

    private _finishSegment(asyncId: number): void {
        const segment = this._activeSegments.get(asyncId);
        if (!segment) {
            return;
        }
        this._activeSegments.delete(asyncId);
        if (this._activeSpans.has(segment.spanId)) {
            this._add(segment.spanId, this._clock.now() - segment.startedAt);
        }
    }

    private _deleteResource(asyncId: number): void {
        this._finishSegment(asyncId);
        this._resourceSpans.delete(asyncId);
    }

    private _add(spanId: string, durationMs: number): void {
        if (!this._activeSpans.has(spanId)) {
            return;
        }
        this._activeMs.set(spanId, (this._activeMs.get(spanId) ?? 0) + Math.max(0, durationMs));
    }
}
