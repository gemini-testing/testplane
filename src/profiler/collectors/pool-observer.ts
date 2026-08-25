import type { PoolObserver, PoolObserverOperation } from "../../browser-pool/types";
import type { ProfilerRuntimeLike } from "../runtime/types";

export class ProfilerPoolObserver implements PoolObserver {
    private readonly _peaks = new Map<string, number>();

    constructor(private readonly _runtime: ProfilerRuntimeLike) {}

    start(kind: string, data: Record<string, string | number | boolean | null>): PoolObserverOperation {
        const browserId = typeof data.browserId === "string" ? data.browserId : undefined;
        const span = this._runtime.startSpan(kind, {
            minLevel: kind === "browser.session.create" ? 1 : 2,
            name: browserId ? `${kind}:${browserId}` : kind,
            context: browserId ? { browserId } : undefined,
            attributes: data,
        });

        return { end: status => span.end(status) };
    }

    record(event: string, data: Record<string, string | number | boolean | null>): void {
        const dimensions = Object.fromEntries(
            Object.entries(data).filter(([, value]) => typeof value === "string" || typeof value === "boolean"),
        );
        const metricValue = typeof data.value === "number" ? data.value : 1;

        if (event.endsWith("Depth") || event.endsWith("Active") || event.endsWith("Launched")) {
            this._runtime.sample(`browser.pool.${event}`, metricValue, dimensions);
            const key = `${event}\0${JSON.stringify(dimensions)}`;
            const peak = Math.max(this._peaks.get(key) ?? 0, metricValue);
            this._peaks.set(key, peak);
            this._runtime.sample(`browser.pool.${event}.peak`, peak, dimensions);
            this._runtime.increment(`browser.pool.${event}.sampleTotal`, metricValue, dimensions);
            this._runtime.increment(`browser.pool.${event}.sampleCount`, 1, dimensions);
            if (event === "sessionsLaunched" && typeof data.limit === "number" && metricValue >= data.limit) {
                this._runtime.increment(`browser.pool.${event}.saturatedSampleCount`, 1, dimensions);
            }
        } else {
            this._runtime.increment(`browser.pool.${event}`, metricValue, dimensions);
        }
    }
}
