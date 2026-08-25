import type { ProfileAggregates, ProfilerAggregate, ProfilerResultV1, TruncationEntry } from "../schema";
import { RETENTION_POLICY_V1 } from "./policy-v1";

const AGGREGATE_KEYS: Array<keyof ProfileAggregates> = [
    "byKind",
    "metrics",
    "phases",
    "listeners",
    "testFiles",
    "tests",
    "hooks",
    "commands",
    "workers",
    "browsers",
];

export function enforceSerializedResultBudget(level: 1 | 2 | 3, source: ProfilerResultV1): ProfilerResultV1 {
    const budget = RETENTION_POLICY_V1.serializedResultBudgetBytes[level];
    if (serializedSize(source) <= budget) {
        return source;
    }

    const seen = detailCount(source);
    const marker: TruncationEntry = {
        collector: "serialized-result-budget",
        seen,
        retained: seen,
        rule: `retain actionable profile data within ${budget} serialized bytes`,
        truncated: true,
    };
    const result = structuredClone(source);
    for (const key of AGGREGATE_KEYS) {
        result.aggregates[key].sort((left, right) => aggregateScore(right) - aggregateScore(left));
    }
    result.profiler.truncation.push(marker);

    trimAggregateDetails(result, budget);
    trimDiagnostics(result, budget);

    if (serializedSize(result) > budget) {
        return minimalResult(result, marker, budget);
    }

    marker.retained = detailCount(result);
    return result;
}

function trimAggregateDetails(result: ProfilerResultV1, budget: number): void {
    while (serializedSize(result) > budget) {
        let changed = false;
        for (const key of AGGREGATE_KEYS) {
            if (result.aggregates[key].length) {
                result.aggregates[key].length = Math.floor(result.aggregates[key].length / 2);
                changed = true;
            }
        }
        if (!changed) {
            return;
        }
    }
}

function trimDiagnostics(result: ProfilerResultV1, budget: number): void {
    const arrays: unknown[][] = [result.profiler.collectionErrors, result.run.partialReasons, result.findings];
    for (const values of arrays) {
        while (serializedSize(result) > budget && values.length > 1) {
            values.length = Math.ceil(values.length / 2);
        }
    }

    while (serializedSize(result) > budget && result.profiler.truncation.length > 1) {
        const entries = result.profiler.truncation.length - 1;
        const retained = Math.floor(entries / 2);
        result.profiler.truncation.splice(retained, entries - retained);
    }
}

function minimalResult(source: ProfilerResultV1, marker: TruncationEntry, budget: number): ProfilerResultV1 {
    const root = source.timeline.find(operation => operation.kind === "testplane.operation");
    const result: ProfilerResultV1 = {
        ...source,
        run: { ...source.run, partialReasons: source.run.partialReasons.slice(0, 1) },
        environment: { ...source.environment, configuredSessionsPerBrowser: undefined },
        timeline: root ? [root] : [],
        aggregates: {
            byKind: [],
            phases: [],
            listeners: [],
            testFiles: [],
            tests: [],
            hooks: [],
            commands: [],
            workers: [],
            browsers: [],
            metrics: [],
        },
        findings: [],
        dataQuality: { ...source.dataQuality, coverage: [] },
        profiler: {
            ...source.profiler,
            collectionErrors: source.profiler.collectionErrors.slice(0, 1),
            truncation: [marker],
        },
    };

    marker.retained = detailCount(result);
    if (serializedSize(result) > budget) {
        throw new Error(`Profiler result metadata exceeds its ${budget} byte budget`);
    }
    return result;
}

function aggregateScore(value: ProfilerAggregate | ProfileAggregates["metrics"][number]): number {
    return "totalWallMs" in value ? value.totalWallMs : Math.abs(value.value);
}

function serializedSize(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value));
}

function detailCount(result: ProfilerResultV1): number {
    return (
        result.timeline.length +
        result.findings.length +
        result.profiler.collectionErrors.length +
        result.run.partialReasons.length +
        AGGREGATE_KEYS.reduce((total, key) => total + result.aggregates[key].length, 0)
    );
}
