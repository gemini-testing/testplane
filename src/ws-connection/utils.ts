import { setTimeout as delayWithSignal } from "node:timers/promises";

export const exponentiallyWait = ({
    baseDelay = 500,
    attempt = 0,
    factor = 2,
    jitter = 100,
    signal,
}: {
    baseDelay?: number;
    attempt?: number;
    factor?: number;
    jitter?: number;
    signal?: AbortSignal;
} = {}): Promise<void> => {
    const delay = Math.round(baseDelay * factor ** attempt + Math.random() * jitter);

    if (signal) return delayWithSignal(delay, undefined, { signal });

    return new Promise(resolve => setTimeout(resolve, delay));
};
