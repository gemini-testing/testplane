import { performance } from "node:perf_hooks";

export interface ProfilerClock {
    /** High-resolution monotonic time in milliseconds. It is suitable for measuring elapsed time. */
    now(): number;
    /** Unix wall-clock timestamp in milliseconds. It is suitable for timestamps shared between processes. */
    epochNow(): number;
    /** Process CPU usage since startup, or since `previousValue` when it is supplied. */
    cpuUsage(previousValue?: NodeJS.CpuUsage): NodeJS.CpuUsage;
    /** Current-thread CPU usage since startup, or since `previousValue` when it is supplied. */
    threadCpuUsage?(previousValue?: NodeJS.CpuUsage): NodeJS.CpuUsage;
}

export const systemClock: ProfilerClock = {
    now: () => performance.now(),
    epochNow: () => Date.now(),
    cpuUsage: (previousValue): NodeJS.CpuUsage => process.cpuUsage(previousValue),
    threadCpuUsage:
        typeof process.threadCpuUsage === "function"
            ? (previousValue): NodeJS.CpuUsage => process.threadCpuUsage(previousValue)
            : undefined,
};

export const cpuUsageToMs = (usage: NodeJS.CpuUsage): number => (usage.user + usage.system) / 1000;
