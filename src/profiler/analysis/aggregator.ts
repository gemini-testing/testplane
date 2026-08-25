import type {
    ProfileAggregates,
    ProfilerAggregate,
    ProfilerError,
    ProfilerOperationName,
    RetainedOperation,
} from "../schema";
import type { RuntimeAggregate, RuntimeSnapshot } from "../runtime/types";

export interface NormalizedProfile {
    runId: string;
    operation: ProfilerOperationName;
    level: RuntimeSnapshot["level"];
    /** Real elapsed time of the complete profiled Testplane operation. */
    durationMs: number;
    timeline: RetainedOperation[];
    aggregates: ProfileAggregates;
    errors: ProfilerError[];
    truncation: RuntimeSnapshot["truncation"];
    /** Sum of time measured inside span-start and span-end bookkeeping. */
    overheadMs: number;
    clock: RuntimeSnapshot["clock"];
}

export const aggregateProfile = (
    snapshot: RuntimeSnapshot,
    durationMs: number,
    operationName: ProfilerOperationName = "run",
): NormalizedProfile => {
    const errors = [...snapshot.errors];
    const rootId = `${snapshot.runId}:operation`;
    const timeline: RetainedOperation[] = snapshot.operations.map(operation => ({
        ...operation,
        timing: { ...operation.timing },
        parentId: operation.parentId ?? rootId,
    }));
    const root: RetainedOperation = {
        id: rootId,
        kind: "testplane.operation",
        name: "Testplane operation",
        process: { type: "master", pid: process.pid },
        context: { runId: snapshot.runId },
        startOffsetMs: 0,
        timing: { wallMs: durationMs },
        attributes: {},
        quality: { timing: "exact", cpu: "process-window" },
        status: "completed",
    };
    timeline.unshift(root);

    const operationsById = new Map(timeline.map(operation => [operation.id, operation]));
    for (const operation of timeline) {
        if (operation.parentId && !operationsById.has(operation.parentId)) {
            errors.push({
                stage: "aggregation.parent",
                code: "MISSING_PARENT",
                message: `Operation ${operation.id} referenced a missing parent`,
            });
            operation.parentId = rootId;
        }
    }

    rejectCycles(root, timeline, operationsById, errors);
    const childrenByParentId = buildChildren(timeline);
    calculateOperationTimings(root, childrenByParentId);
    addUnattributedOperations(timeline, childrenByParentId, snapshot.runId);
    timeline.sort((left, right) => left.startOffsetMs - right.startOffsetMs || left.id.localeCompare(right.id));

    return {
        runId: snapshot.runId,
        operation: operationName,
        level: snapshot.level,
        durationMs,
        timeline,
        aggregates: categorizeAggregates(snapshot.aggregates, snapshot.metrics),
        errors,
        truncation: snapshot.truncation,
        overheadMs: snapshot.overheadMs,
        clock: snapshot.clock,
    };
};

function buildChildren(timeline: RetainedOperation[]): Map<string, RetainedOperation[]> {
    const childrenByParentId = new Map<string, RetainedOperation[]>();
    for (const operation of timeline) {
        if (!operation.parentId) {
            continue;
        }
        const siblings = childrenByParentId.get(operation.parentId) ?? [];
        siblings.push(operation);
        childrenByParentId.set(operation.parentId, siblings);
    }
    return childrenByParentId;
}

function rejectCycles(
    root: RetainedOperation,
    timeline: RetainedOperation[],
    operationsById: Map<string, RetainedOperation>,
    errors: ProfilerError[],
): void {
    for (const operation of timeline) {
        if (operation.id === root.id) {
            continue;
        }
        const visited = new Set<string>([operation.id]);
        let parentId = operation.parentId;
        while (parentId) {
            if (visited.has(parentId)) {
                operation.parentId = root.id;
                errors.push({
                    stage: "aggregation.dag",
                    code: "CYCLE",
                    message: `Dropped cyclic parent edge for operation ${operation.id}`,
                });
                break;
            }
            visited.add(parentId);
            parentId = operationsById.get(parentId)?.parentId;
        }
    }
}

function calculateOperationTimings(
    operation: RetainedOperation,
    childrenByParentId: Map<string, RetainedOperation[]>,
): number {
    const directChildren = childrenByParentId.get(operation.id) ?? [];
    const retainedChildUnionMs = operationUnionWithin(operation, directChildren);
    const observedChildUnionMs = operation.timing.observedChildUnionMs;
    const childUnionMs =
        observedChildUnionMs !== undefined
            ? Math.min(operation.timing.wallMs, Math.max(retainedChildUnionMs, observedChildUnionMs))
            : retainedChildUnionMs;
    const cumulativeChildWorkMs = directChildren.reduce((total, child) => total + child.timing.wallMs, 0);

    operation.timing.selfWallMs = Math.max(0, operation.timing.wallMs - childUnionMs);
    operation.timing.cumulativeWorkMs = cumulativeChildWorkMs;
    operation.timing.overlapMs = Math.max(0, cumulativeChildWorkMs - retainedChildUnionMs);

    let longestChildPath = 0;
    for (const child of directChildren) {
        longestChildPath = Math.max(longestChildPath, calculateOperationTimings(child, childrenByParentId));
    }
    operation.timing.criticalPathMs = Math.min(
        operation.timing.wallMs,
        (operation.timing.selfWallMs ?? 0) + longestChildPath,
    );

    return operation.timing.criticalPathMs;
}

export function unionDuration(intervals: ReadonlyArray<readonly [number, number]>): number {
    if (!intervals.length) {
        return 0;
    }

    const sortedIntervals = [...intervals].sort(([left], [right]) => left - right);
    let [currentStart, currentEnd] = sortedIntervals[0];
    let totalDuration = 0;

    for (let index = 1; index < sortedIntervals.length; index += 1) {
        const [start, end] = sortedIntervals[index];
        if (start <= currentEnd) {
            currentEnd = Math.max(currentEnd, end);
        } else {
            totalDuration += currentEnd - currentStart;
            currentStart = start;
            currentEnd = end;
        }
    }

    return totalDuration + currentEnd - currentStart;
}

function addUnattributedOperations(
    timeline: RetainedOperation[],
    childrenByParentId: Map<string, RetainedOperation[]>,
    runId: string,
): void {
    let sequence = 0;
    for (const parent of [...timeline]) {
        const unattributedMs = parent.timing.selfWallMs ?? 0;
        const directChildren = childrenByParentId.get(parent.id);
        if (unattributedMs <= 0 || !directChildren) {
            continue;
        }

        const retainedChildUnionMs = operationUnionWithin(parent, directChildren);
        const observedChildUnionMs = parent.timing.observedChildUnionMs;
        const childrenTruncated = observedChildUnionMs !== undefined && observedChildUnionMs > retainedChildUnionMs + 1;

        sequence += 1;
        timeline.push({
            id: `${runId}:unattributed:${sequence}`,
            parentId: parent.id,
            kind: "testplane.phase.unattributed",
            name: "Unattributed",
            process: parent.process,
            context: parent.context,
            startOffsetMs: parent.startOffsetMs,
            timing: {
                wallMs: unattributedMs,
                selfWallMs: unattributedMs,
                cumulativeWorkMs: 0,
                overlapMs: 0,
                criticalPathMs: unattributedMs,
            },
            attributes: childrenTruncated ? { retentionAffected: true } : {},
            quality: {
                timing: "estimated",
                cpu: "unavailable",
                notes: childrenTruncated
                    ? [
                          "Parent interval minus retained child intervals; some child detail was dropped by retention, so this residual is a detail-budget artifact, not missing instrumentation",
                      ]
                    : ["Computed as parent interval minus the union of retained direct child intervals"],
            },
            status: "completed",
        });
    }
}

export function operationUnionWithin(parent: RetainedOperation, operations: RetainedOperation[]): number {
    const parentStart = parent.startOffsetMs;
    const parentEnd = parentStart + parent.timing.wallMs;
    const intervals = operations
        .map(
            child =>
                [
                    Math.max(parentStart, child.startOffsetMs),
                    Math.min(parentEnd, child.startOffsetMs + child.timing.wallMs),
                ] as const,
        )
        .filter(([start, end]) => end > start);
    return unionDuration(intervals);
}

function categorizeAggregates(aggregates: RuntimeAggregate[], metrics: RuntimeSnapshot["metrics"]): ProfileAggregates {
    const profilerAggregates = aggregates.map(toProfilerAggregate);
    const filterByKindPrefix = (prefixes: string[]): ProfilerAggregate[] =>
        profilerAggregates.filter(aggregate => prefixes.some(prefix => aggregate.kind.startsWith(prefix)));
    const commandRoot = profilerAggregates.find(
        aggregate => aggregate.kind === "browser.command.root" && aggregate.name === "<root>",
    );
    const commandCumulative = profilerAggregates.find(
        aggregate => aggregate.kind === "browser.command.cumulative" && aggregate.name === "<all>",
    );
    const commandSummary = commandRoot
        ? {
              ...commandRoot,
              kind: "browser.command",
              name: "<root>",
              cumulativeWorkMs: commandCumulative?.totalWallMs ?? commandRoot.totalWallMs,
              overlapMs: Math.max(
                  0,
                  (commandCumulative?.totalWallMs ?? commandRoot.totalWallMs) - commandRoot.totalWallMs,
              ),
          }
        : undefined;

    return {
        // Browser kinds live in `commands` / `browsers` only — keep byKind free of that duplication.
        byKind: profilerAggregates.filter(aggregate => !aggregate.kind.startsWith("browser.")),
        phases: filterByKindPrefix(["testplane.phase."]),
        listeners: filterByKindPrefix(["event.listener", "user.callback"]),
        testFiles: filterByKindPrefix(["test.file", "files.load"]),
        tests: filterByKindPrefix(["test.attempt", "test.body"]),
        hooks: filterByKindPrefix(["test.hook", "test.beforeEach", "test.afterEach"]),
        commands: [
            ...(commandSummary ? [commandSummary] : []),
            ...profilerAggregates.filter(aggregate => aggregate.kind === "browser.command"),
        ],
        workers: filterByKindPrefix(["worker."]),
        // Session/pool/runnable stay here; command family is only under `commands`.
        browsers: profilerAggregates.filter(
            aggregate =>
                (aggregate.kind.startsWith("browser.") || aggregate.kind.startsWith("session.")) &&
                !aggregate.kind.startsWith("browser.command"),
        ),
        metrics: metrics.map(({ name, value, dimensions }) => ({ name, value, dimensions })),
    };
}

function toProfilerAggregate({ kind, name, attributes, statistics }: RuntimeAggregate): ProfilerAggregate {
    return {
        kind,
        name,
        count: statistics.count,
        totalWallMs: statistics.sum,
        minWallMs: statistics.min,
        maxWallMs: statistics.max,
        meanWallMs: statistics.mean,
        p50WallMs: statistics.p50,
        p95WallMs: statistics.p95,
        cumulativeWorkMs: statistics.sum,
        attributes,
    };
}
