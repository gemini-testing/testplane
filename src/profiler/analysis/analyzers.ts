import type { Finding, FindingEvidence, ProfilerAggregate, ProfilerValue, RetainedOperation } from "../schema";
import { operationUnionWithin, unionDuration, type NormalizedProfile } from "./aggregator";
import { compareFindings } from "./finding-order";
import { findRobustOutliers } from "./outliers";
import { ANALYSIS_POLICY_V1 } from "./policy-v1";

/* eslint-disable no-use-before-define -- analyzer declarations intentionally precede the shared registry/helpers */

export type FindingDraft = Omit<Finding, "id">;

export interface ProfilerAnalyzer {
    readonly id: string;
    /** Lowest profiler detail level that provides enough data for this analyzer. */
    readonly minLevel: 1 | 2 | 3;
    analyze(profile: NormalizedProfile): FindingDraft[];
}

const createDefaultAnalyzers = (): ProfilerAnalyzer[] => [
    longRunAnalyzer,
    majorPhaseAnalyzer,
    testDiscoveryAnalyzer,
    unattributedAnalyzer,
    listenerAnalyzer,
    testFileAnalyzer,
    moduleDependencyAnalyzer,
    slowTestAnalyzer,
    hookAnalyzer,
    commandAnalyzer,
];

export const runAnalyzers = (profile: NormalizedProfile, analyzers = createDefaultAnalyzers()): Finding[] => {
    const findings: FindingDraft[] = [];

    for (const analyzer of analyzers) {
        if (profile.level < analyzer.minLevel) {
            continue;
        }

        try {
            findings.push(...analyzer.analyze(profile));
        } catch (error) {
            profile.errors.push({
                stage: `analysis.${analyzer.id}`,
                message: String((error as Error)?.message ?? error).slice(0, 1000),
            });
        }
    }

    return findings
        .sort(compareFindings)
        .slice(0, 50)
        .map(
            (finding, index): Finding => ({
                ...finding,
                id: `${finding.analyzer.id}:${index + 1}`,
            }),
        );
};

const TEST_DISCOVERY_PHASE = "testplane.phase.test-discovery";

const NON_ACTIONABLE_PHASES = new Set([
    "testplane.phase.execution",
    "testplane.phase.unattributed",
    TEST_DISCOVERY_PHASE,
]);

const longRunAnalyzer: ProfilerAnalyzer = {
    id: "long-run-v1",
    minLevel: 1,
    analyze: profile => {
        if (profile.operation !== "run" || profile.durationMs <= ANALYSIS_POLICY_V1.longRun.thresholdMs) {
            return [];
        }

        const hostCpu95thPercentile = sampledAggregateValue(profile, "host.cpuUtilization", "p95WallMs", {
            process: "host",
        });
        const isHostCpuHigh =
            hostCpu95thPercentile !== undefined &&
            hostCpu95thPercentile >= ANALYSIS_POLICY_V1.hostCpu.high95thPercentile;
        const root = profile.timeline.find(operation => operation.kind === "testplane.operation");
        const hostCpuObservation =
            hostCpu95thPercentile === undefined
                ? " Host CPU utilization data was unavailable."
                : ` Host CPU p95 was ${formatPercent(hostCpu95thPercentile)}, ${
                      isHostCpuHigh ? "at or above" : "below"
                  } the ${formatPercent(ANALYSIS_POLICY_V1.hostCpu.high95thPercentile)} high-load threshold.`;
        const evidence: FindingEvidence[] = [
            {
                metric: "wall",
                value: profile.durationMs,
                unit: "ms",
                threshold: ANALYSIS_POLICY_V1.longRun.thresholdMs,
                ...(root ? { operationId: root.id } : {}),
            },
            {
                metric: "cpuState",
                value: isHostCpuHigh ? "high" : hostCpu95thPercentile === undefined ? "unavailable" : "headroom",
            },
        ];
        if (hostCpu95thPercentile !== undefined) {
            evidence.push({
                metric: "hostCpuP95",
                value: hostCpu95thPercentile,
                unit: "ratio",
                threshold: ANALYSIS_POLICY_V1.hostCpu.high95thPercentile,
            });
        }

        return [
            simpleFinding({
                analyzerId: "long-run-v1",
                category: "run-duration",
                observation: `The full test run took ${formatMs(profile.durationMs)}, longer than the ${
                    ANALYSIS_POLICY_V1.longRun.thresholdMs / 60_000
                }-minute threshold.${hostCpuObservation}`,
                evidence,
                action: longRunAction(hostCpu95thPercentile),
                confidence: "high",
                operationIds: root ? [root.id] : [],
            }),
        ];
    },
};

function longRunAction(hostCpu95thPercentile: number | undefined): string {
    if (hostCpu95thPercentile === undefined) {
        return "Host CPU data was unavailable or insufficient. Check host CPU and browser-grid capacity first; if both have headroom, increase browser-session parallelism by raising sessionsPerBrowser.";
    }
    if (hostCpu95thPercentile >= ANALYSIS_POLICY_V1.hostCpu.high95thPercentile) {
        return "Use @testplane/chunks to split the suite across CI jobs running in parallel on separate available hardware. The plugin selects deterministic chunks but does not orchestrate the jobs; sequential chunks will not reduce total time.";
    }
    return "Increase browser-session parallelism where capacity allows by raising sessionsPerBrowser. Compare the next run and stop before browser-grid or host saturation.";
}

const majorPhaseAnalyzer: ProfilerAnalyzer = {
    id: "major-phase-v1",
    minLevel: 1,
    analyze: profile =>
        profile.timeline
            .filter(
                operation =>
                    operation.kind.startsWith("testplane.phase.") && !NON_ACTIONABLE_PHASES.has(operation.kind),
            )
            .filter(operation => isSignificantPhase(profile, operation))
            .map(operation => majorPhaseFinding(profile, operation)),
};

const testDiscoveryAnalyzer: ProfilerAnalyzer = {
    id: "test-discovery-v1",
    minLevel: 1,
    analyze: profile =>
        profile.timeline
            .filter(
                operation =>
                    operation.kind === TEST_DISCOVERY_PHASE &&
                    operation.process.type === "master" &&
                    isSignificantPhase(profile, operation),
            )
            .map(operation => testDiscoveryFinding(profile, operation)),
};

function isSignificantPhase(profile: NormalizedProfile, operation: RetainedOperation): boolean {
    return (
        operation.timing.wallMs >= ANALYSIS_POLICY_V1.majorPhase.minWallMs &&
        operation.timing.wallMs / profile.durationMs >= ANALYSIS_POLICY_V1.majorPhase.minRunShare
    );
}

const unattributedAnalyzer: ProfilerAnalyzer = {
    id: "unattributed-v1",
    minLevel: 1,
    analyze: profile =>
        profile.timeline
            .filter(operation => operation.kind === "testplane.phase.unattributed")
            .filter(operation => operation.attributes.retentionAffected !== true)
            .filter(operation => {
                const parent = profile.timeline.find(candidate => candidate.id === operation.parentId);
                return (
                    operation.timing.wallMs >= ANALYSIS_POLICY_V1.unattributed.minWallMs &&
                    operation.timing.wallMs / (parent?.timing.wallMs || profile.durationMs) >=
                        ANALYSIS_POLICY_V1.unattributed.minShare
                );
            })
            .map(operation => {
                const parent = profile.timeline.find(candidate => candidate.id === operation.parentId);
                const location = parent ? ` inside \`${parent.name}\`` : "";
                const gap = parent ? largestUnattributedGap(profile, parent) : undefined;
                const gapObservation = unattributedGapObservation(gap);
                const gapEvidence: FindingEvidence[] = gap
                    ? [
                          {
                              metric: "largestUnattributedInterval",
                              value: gap.wallMs,
                              unit: "ms",
                              operationId: operation.id,
                          },
                          ...(gap.previous
                              ? [
                                    {
                                        metric: "previousOperation",
                                        value: gap.previous.name,
                                        operationId: gap.previous.id,
                                    },
                                ]
                              : []),
                          ...(gap.next
                              ? [
                                    {
                                        metric: "nextOperation",
                                        value: gap.next.name,
                                        operationId: gap.next.id,
                                    },
                                ]
                              : []),
                      ]
                    : [];
                return {
                    analyzer: { id: "unattributed-v1", version: 1 },
                    category: "coverage",
                    severity: "warning" as const,
                    observation: `${formatMs(
                        operation.timing.wallMs,
                    )}${location} could not be attributed to a known child operation.${gapObservation}`,
                    evidence: [
                        {
                            metric: "unattributedWall",
                            value: operation.timing.wallMs,
                            unit: "ms",
                            operationId: operation.id,
                        },
                        ...(parent ? [{ metric: "parentPhase", value: parent.name }] : []),
                        ...gapEvidence,
                    ],
                    action: unattributedAction(profile, parent, gap),
                    confidence: "medium" as const,
                    operationIds: [
                        operation.id,
                        ...(gap?.previous ? [gap.previous.id] : []),
                        ...(gap?.next ? [gap.next.id] : []),
                    ],
                    confidenceReasons: ["Unattributed time is computed from retained child intervals"],
                };
            }),
};

interface UnattributedGap {
    /** Elapsed time inside the parent that is not covered by a retained child operation. */
    wallMs: number;
    previous?: RetainedOperation;
    next?: RetainedOperation;
}

function largestUnattributedGap(profile: NormalizedProfile, parent: RetainedOperation): UnattributedGap | undefined {
    const parentStart = parent.startOffsetMs;
    const parentEnd = parentStart + parent.timing.wallMs;
    const children = profile.timeline
        .filter(
            operation =>
                operation.parentId === parent.id &&
                operation.kind !== "testplane.phase.unattributed" &&
                operation.timing.wallMs > 0,
        )
        .map(operation => ({
            operation,
            start: Math.max(parentStart, operation.startOffsetMs),
            end: Math.min(parentEnd, operation.startOffsetMs + operation.timing.wallMs),
        }))
        .filter(interval => interval.end > interval.start)
        .sort((left, right) => left.start - right.start || right.end - left.end);
    if (!children.length) {
        return { wallMs: parent.timing.wallMs };
    }

    const gaps: UnattributedGap[] = [];
    let cursor = parentStart;
    let previous: RetainedOperation | undefined;
    for (const child of children) {
        if (child.start > cursor) {
            gaps.push({
                wallMs: child.start - cursor,
                previous,
                next: child.operation,
            });
        }
        if (child.end > cursor) {
            cursor = child.end;
            previous = child.operation;
        }
    }
    if (cursor < parentEnd) {
        gaps.push({ wallMs: parentEnd - cursor, previous });
    }

    return gaps.sort((left, right) => right.wallMs - left.wallMs)[0];
}

function unattributedGapObservation(gap: UnattributedGap | undefined): string {
    if (!gap) {
        return "";
    }
    if (gap.previous && gap.next) {
        return ` The largest unattributed interval was ${formatMs(gap.wallMs)} between ${unattributedBoundary(
            gap.previous,
        )} and ${unattributedBoundary(gap.next)}.`;
    }
    if (gap.previous) {
        return ` The largest unattributed interval was ${formatMs(gap.wallMs)} after ${unattributedBoundary(
            gap.previous,
        )}.`;
    }
    if (gap.next) {
        return ` The largest unattributed interval was ${formatMs(gap.wallMs)} before ${unattributedBoundary(
            gap.next,
        )}.`;
    }
    return "";
}

function unattributedBoundary(operation: RetainedOperation): string {
    return `${operationKindLabel(operation.kind)} \`${operation.name}\``;
}

const OPERATION_KIND_LABELS: Readonly<Record<string, string>> = {
    "browser.command": "browser command",
    "event.listener": "event listener",
    "user.callback": "callback",
    "test.hook": "hook",
    "test.body": "test body",
    "test.attempt": "test",
    "worker.test-attempt": "test",
    "module.load": "module load",
    "test.file.load": "test file load",
    "worker.call": "worker call",
};

function operationKindLabel(kind: string): string {
    return (
        OPERATION_KIND_LABELS[kind] ??
        (kind.startsWith("browser.session.")
            ? "browser session operation"
            : kind.startsWith("testplane.phase.")
            ? "phase"
            : "operation")
    );
}

function unattributedAction(
    profile: NormalizedProfile,
    parent: RetainedOperation | undefined,
    gap: UnattributedGap | undefined,
): string {
    const location =
        gap?.previous && gap.next
            ? `between ${unattributedBoundary(gap.previous)} and ${unattributedBoundary(gap.next)}`
            : gap?.previous
            ? `after ${unattributedBoundary(gap.previous)}`
            : gap?.next
            ? `before ${unattributedBoundary(gap.next)}`
            : parent
            ? `inside \`${parent.name}\``
            : "during this interval";
    const inspect = `Inspect custom code that can run ${location}, including plugins or listeners, callbacks, module initialization, and synchronous filesystem or CPU work. Disable only suspected extensions one at a time.`;
    return profile.level < 3
        ? `Try profiler.level 3 to retain more operations around this interval. ${inspect}`
        : inspect;
}

const listenerAnalyzer: ProfilerAnalyzer = {
    id: "event-listener-v1",
    minLevel: 2,
    analyze: profile => {
        const aggregates = profile.aggregates.listeners
            .filter(aggregate => !aggregate.name.startsWith("internal:"))
            // A listener is only slow if it is slow per call: a low per-call average across many
            // events is normal, not a bottleneck, even when the cumulative total is large.
            .filter(
                aggregate =>
                    aggregate.meanWallMs >= ANALYSIS_POLICY_V1.eventListener.minMeanWallMs &&
                    (aggregate.maxWallMs >= ANALYSIS_POLICY_V1.eventListener.minSingleWallMs ||
                        aggregate.totalWallMs >= ANALYSIS_POLICY_V1.eventListener.minTotalWallMs) &&
                    aggregate.totalWallMs / profile.durationMs >= ANALYSIS_POLICY_V1.eventListener.minRunShare,
            );
        const slowestOperations = aggregates.map(aggregate => retainedOperationsForAggregate(profile, aggregate)[0]);
        const locations = shortestUniqueSourceLocations(slowestOperations.map(operation => operation?.source));

        return aggregates.map((aggregate, index) =>
            listenerFinding(aggregate, profile, slowestOperations[index], locations[index]),
        );
    },
};

const testFileAnalyzer: ProfilerAnalyzer = {
    id: "test-file-v1",
    minLevel: 2,
    analyze: profile => {
        // One file loads many times (per worker/session/retry/browser); collapse to the worst
        // instance per file so a single slow file produces a single finding, not dozens.
        const operations = dedupeByNameMaxWall(
            profile.timeline.filter(operation => operation.kind.startsWith("test.file")),
        );
        const fileLoadWall = operations.reduce((total, operation) => total + operation.timing.wallMs, 0);
        const candidates =
            operations.length >= 8
                ? findRobustOutliers(operations, operation => operation.timing.wallMs)
                : operations.map(operation => ({
                      item: operation,
                      measurement: operation.timing.wallMs,
                  }));
        const retained = candidates
            .filter(candidate => candidate.measurement >= ANALYSIS_POLICY_V1.testFile.minWallMs)
            .slice(0, Math.max(3, Math.ceil(operations.length * 0.1)));
        if (
            retained.reduce((total, candidate) => total + candidate.measurement, 0) / Math.max(1, fileLoadWall) <
            ANALYSIS_POLICY_V1.testFile.minGroupShare
        ) {
            return [];
        }
        return retained.map(({ item: operation }) =>
            operationFinding("test-file-v1", "test-file", operation, profile, testFileAction(profile, operation)),
        );
    },
};

const moduleDependencyAnalyzer: ProfilerAnalyzer = {
    id: "module-dependency-v1",
    minLevel: 3,
    analyze: profile => {
        const modules = dedupeByNameMaxWall(
            profile.timeline.filter(
                operation =>
                    operation.kind === "module.load" &&
                    typeof operation.attributes.ownerFile === "string" &&
                    !operation.attributes.cacheHit &&
                    operation.attributes.module !== operation.attributes.ownerFile &&
                    // Testplane's own internals are not user-actionable dependencies.
                    !isFrameworkModule(String(operation.attributes.module ?? operation.name)),
            ),
        );
        const candidates =
            modules.length >= 8
                ? findRobustOutliers(modules, operation => operation.timing.wallMs)
                : modules.map(operation => ({
                      item: operation,
                      measurement: operation.timing.wallMs,
                  }));
        return candidates
            .filter(({ measurement }) => measurement >= 100 && measurement / profile.durationMs >= 0.01)
            .slice(0, Math.max(3, Math.ceil(modules.length * 0.1)))
            .map(({ item: operation }) =>
                operationFinding(
                    "module-dependency-v1",
                    "module",
                    operation,
                    profile,
                    moduleDependencyAction(operation.attributes.ownerFile as string),
                ),
            );
    },
};

const slowTestAnalyzer: ProfilerAnalyzer = {
    id: "slow-test-v1",
    minLevel: 2,
    analyze: profile => {
        const tests = profile.aggregates.tests.filter(aggregate => aggregate.kind === "test.body");
        if (!tests.length) {
            return [];
        }
        const meanPerCall = tests.reduce((sum, aggregate) => sum + aggregate.meanWallMs, 0) / tests.length;
        const relativeGate =
            tests.length >= ANALYSIS_POLICY_V1.slowTest.minSampleForRelative
                ? meanPerCall * ANALYSIS_POLICY_V1.slowTest.minMeanMultiple
                : 0;
        return tests
            .filter(
                aggregate =>
                    aggregate.maxWallMs >= ANALYSIS_POLICY_V1.slowTest.minWallMs &&
                    aggregate.totalWallMs / profile.durationMs >= ANALYSIS_POLICY_V1.slowTest.minExecutionShare &&
                    aggregate.meanWallMs >= relativeGate,
            )
            .map(aggregate =>
                aggregateFinding(
                    "slow-test-v1",
                    "test",
                    aggregate,
                    profile,
                    "Inspect slow commands and awaited operations inside this test body; remove avoidable waits from its critical path.",
                ),
            );
    },
};

const hookAnalyzer: ProfilerAnalyzer = {
    id: "common-hook-v1",
    minLevel: 2,
    analyze: profile => {
        const findings: FindingDraft[] = [];

        for (const aggregate of profile.aggregates.hooks) {
            if (
                aggregate.count < ANALYSIS_POLICY_V1.commonHook.minCalls ||
                aggregate.totalWallMs < ANALYSIS_POLICY_V1.commonHook.minTotalWallMs ||
                aggregate.totalWallMs / profile.durationMs < ANALYSIS_POLICY_V1.commonHook.minExecutionShare
            ) {
                continue;
            }

            // Parallel tests inflate cumulative hook work. For moderate hooks, require their
            // retained intervals to occupy a material part of the run's actual wall time.
            const observedWallMs = operationUnionWall(profile, aggregate);
            if (
                aggregate.meanWallMs < ANALYSIS_POLICY_V1.commonHook.minMeanWallMs &&
                observedWallMs / profile.durationMs < ANALYSIS_POLICY_V1.commonHook.minExecutionShare
            ) {
                continue;
            }

            const finding = aggregateFinding(
                "common-hook-v1",
                "hook",
                aggregate,
                profile,
                "Check whether every test in this suite needs the hook's full setup. Optimize the repeated work, or split the tests into smaller suites with focused hooks so each test runs only the setup it needs.",
            );
            if (observedWallMs > 0) {
                finding.evidence.push({
                    metric: "observedUnionWall",
                    value: observedWallMs,
                    unit: "ms",
                    threshold: profile.durationMs * ANALYSIS_POLICY_V1.commonHook.minExecutionShare,
                });
            }
            findings.push(finding);
        }

        return findings;
    },
};

const commandAnalyzer: ProfilerAnalyzer = {
    id: "browser-command-v1",
    minLevel: 3,
    analyze: profile =>
        profile.aggregates.commands
            .filter(aggregate => aggregate.name !== "<root>")
            .flatMap(aggregate => {
                if (aggregate.name === "pause") {
                    const matchesPause =
                        aggregate.totalWallMs >= ANALYSIS_POLICY_V1.pause.minTotalWallMs &&
                        (aggregate.count >= ANALYSIS_POLICY_V1.pause.minCalls ||
                            aggregate.maxWallMs >= ANALYSIS_POLICY_V1.pause.minSingleWallMs) &&
                        aggregate.totalWallMs / profile.durationMs >= ANALYSIS_POLICY_V1.pause.minShare;
                    return matchesPause
                        ? [
                              aggregateFinding(
                                  "browser-pause-v1",
                                  "browser-command",
                                  aggregate,
                                  profile,
                                  "Replace static browser.pause calls with a condition-based wait.",
                              ),
                          ]
                        : [];
                }

                return aggregate.meanWallMs >= ANALYSIS_POLICY_V1.command.minMeanWallMs &&
                    aggregate.totalWallMs >= ANALYSIS_POLICY_V1.command.minWallMs &&
                    aggregate.totalWallMs / profile.durationMs >= ANALYSIS_POLICY_V1.command.minExecutionShare
                    ? [commandFinding(aggregate, profile)]
                    : [];
            }),
};

const aggregateFinding = (
    analyzerId: string,
    category: string,
    aggregate: ProfilerAggregate,
    profile: NormalizedProfile,
    action: string,
): FindingDraft => {
    const retained = retainedOperationsForAggregate(profile, aggregate);
    return {
        analyzer: { id: analyzerId, version: 1 },
        category,
        severity: "warning",
        observation: `\`${aggregate.name}\` used ${formatMs(aggregate.totalWallMs)} across ${aggregate.count} call(s).`,
        evidence: [
            { metric: "count", value: aggregate.count },
            { metric: "totalWall", value: aggregate.totalWallMs, unit: "ms" },
            { metric: "meanWall", value: aggregate.meanWallMs, unit: "ms" },
            { metric: "maxWall", value: aggregate.maxWallMs, unit: "ms" },
            {
                metric: "runShare",
                value: aggregate.totalWallMs / profile.durationMs,
                unit: "ratio",
            },
            ...retained.slice(0, 1).map(operation => ({
                metric: "slowestRetainedCall",
                value: operation.timing.wallMs,
                unit: "ms",
                operationId: operation.id,
            })),
        ],
        action,
        confidence: "medium",
        operationIds: retained.map(operation => operation.id),
        entityIds: [aggregate.name],
        confidenceReasons: ["The total is cumulative work and may overlap other operations"],
    };
};

const operationFinding = (
    analyzerId: string,
    category: string,
    operation: RetainedOperation,
    profile: NormalizedProfile,
    action: string,
): FindingDraft => ({
    analyzer: { id: analyzerId, version: 1 },
    category,
    severity: "warning",
    observation: `\`${operation.name}\` took ${formatMs(operation.timing.wallMs)}.`,
    evidence: [
        {
            metric: "wall",
            value: operation.timing.wallMs,
            unit: "ms",
            operationId: operation.id,
        },
        {
            metric: "runShare",
            value: operation.timing.wallMs / profile.durationMs,
            unit: "ratio",
            operationId: operation.id,
        },
    ],
    action,
    confidence: operation.quality.timing === "exact" ? "high" : "medium",
    operationIds: [operation.id],
    entityIds: [operation.name],
});

const simpleFinding = ({
    analyzerId,
    ...finding
}: Omit<FindingDraft, "analyzer" | "severity"> & {
    analyzerId: string;
}): FindingDraft => ({
    analyzer: { id: analyzerId, version: 1 },
    severity: "warning",
    ...finding,
});

interface TestDiscoveryBreakdown {
    /** Elapsed time spent resolving file patterns and finding matching test files. */
    globWallMs: number;
    /** Elapsed time covered by loading discovered test files. */
    fileLoadWallMs: number;
    /** Combined elapsed time covered by parsing, grouping, and validation, with overlaps counted once. */
    parseWallMs: number;
    /** Remaining discovery-phase time not assigned to the documented categories. */
    otherWallMs: number;
    fileCount?: number;
    /** Average elapsed load time per discovered test file. */
    averageFileLoadMs?: number;
    hasFileLoadOutliers?: boolean;
    outliers: RetainedOperation[];
    operations: RetainedOperation[];
}

function testDiscoveryFinding(profile: NormalizedProfile, phase: RetainedOperation): FindingDraft {
    const breakdown = testDiscoveryBreakdown(profile, phase);
    const evidence: FindingEvidence[] = [
        {
            metric: "wall",
            value: phase.timing.wallMs,
            unit: "ms",
            threshold: ANALYSIS_POLICY_V1.majorPhase.minWallMs,
            operationId: phase.id,
        },
        {
            metric: "runShare",
            value: phase.timing.wallMs / profile.durationMs,
            unit: "ratio",
            threshold: ANALYSIS_POLICY_V1.majorPhase.minRunShare,
            operationId: phase.id,
        },
        { metric: "discoveryGlobWall", value: breakdown.globWallMs, unit: "ms" },
        { metric: "fileLoadWall", value: breakdown.fileLoadWallMs, unit: "ms" },
        { metric: "testParseWall", value: breakdown.parseWallMs, unit: "ms" },
        { metric: "otherDiscoveryWall", value: breakdown.otherWallMs, unit: "ms" },
    ];

    if (breakdown.fileCount !== undefined) {
        evidence.push({ metric: "fileCount", value: breakdown.fileCount });
    }
    if (breakdown.averageFileLoadMs !== undefined) {
        evidence.push(
            {
                metric: "averageFileLoad",
                value: breakdown.averageFileLoadMs,
                unit: "ms",
            },
            {
                metric: "fileLoadOutlierThreshold",
                value: breakdown.averageFileLoadMs * 3,
                unit: "ms",
            },
        );
    }
    if (breakdown.hasFileLoadOutliers !== undefined) {
        evidence.push({
            metric: "hasFileLoadOutliers",
            value: breakdown.hasFileLoadOutliers,
        });
    }
    for (const outlier of breakdown.outliers) {
        evidence.push(
            {
                metric: "fileLoadOutlier",
                value: outlier.name,
                operationId: outlier.id,
            },
            {
                metric: "fileLoadOutlierWall",
                value: outlier.timing.wallMs,
                unit: "ms",
                operationId: outlier.id,
            },
        );
    }

    const discoveryOnly = profile.operation === "readTests" || profile.operation === "cli:list-tests";
    return {
        analyzer: { id: "test-discovery-v1", version: 1 },
        category: "test-discovery",
        severity: "warning",
        observation: `\`${phase.name}\` took ${formatMs(phase.timing.wallMs)} (${formatPercent(
            phase.timing.wallMs / profile.durationMs,
        )} of the run).${discoveryOnly ? " This operation does not execute tests." : ""}`,
        evidence,
        action: testDiscoveryAction(profile, breakdown),
        confidence: "high",
        operationIds: [...new Set([phase.id, ...breakdown.operations.map(operation => operation.id)])].slice(0, 12),
        entityIds: [phase.name],
    };
}

function testDiscoveryBreakdown(profile: NormalizedProfile, phase: RetainedOperation): TestDiscoveryBreakdown {
    const children = profile.timeline.filter(
        operation =>
            operation.parentId === phase.id &&
            operation.process.type === "master" &&
            operation.kind !== "testplane.phase.unattributed",
    );
    const globOperations = children.filter(operation => operation.kind === "sets.resolve-and-glob");
    const fileLoadOperation = children
        .filter(operation => operation.kind === "files.load")
        .sort((left, right) => right.timing.wallMs - left.timing.wallMs)[0];
    const parseOperations = children.filter(operation =>
        ["files.group-by-browser", "tests.parse", "tests.validate"].includes(operation.kind),
    );
    const knownOperations = [...globOperations, ...(fileLoadOperation ? [fileLoadOperation] : []), ...parseOperations];
    const knownWallMs = operationUnionWithin(phase, knownOperations);
    const fileSummary = profile.aggregates.testFiles.find(
        aggregate =>
            aggregate.kind === "test.file.load.summary" &&
            (aggregate.attributes?.process === "master" || aggregate.name === "master"),
    );
    const fileCount =
        typeof fileLoadOperation?.attributes.files === "number"
            ? fileLoadOperation.attributes.files
            : fileSummary?.count;
    const averageFileLoadMs =
        fileSummary?.meanWallMs ??
        (fileLoadOperation && fileCount ? fileLoadOperation.timing.wallMs / fileCount : undefined);
    const outlierThresholdMs =
        averageFileLoadMs !== undefined && averageFileLoadMs > 0 ? averageFileLoadMs * 3 : undefined;
    const retainedFileLoads = fileLoadOperation
        ? profile.timeline
              .filter(
                  operation =>
                      operation.parentId === fileLoadOperation.id &&
                      operation.kind === "test.file.load" &&
                      operation.process.type === "master",
              )
              .sort((left, right) => right.timing.wallMs - left.timing.wallMs)
        : [];
    const outliers =
        outlierThresholdMs === undefined
            ? []
            : retainedFileLoads.filter(operation => operation.timing.wallMs >= outlierThresholdMs).slice(0, 3);
    const hasFileLoadOutliers =
        outlierThresholdMs === undefined
            ? undefined
            : fileSummary
            ? fileSummary.maxWallMs >= outlierThresholdMs
            : profile.level >= 2
            ? outliers.length > 0
            : undefined;

    return {
        globWallMs: operationUnionWithin(phase, globOperations),
        fileLoadWallMs: fileLoadOperation?.timing.wallMs ?? 0,
        parseWallMs: operationUnionWithin(phase, parseOperations),
        otherWallMs: Math.max(0, phase.timing.wallMs - knownWallMs),
        fileCount,
        averageFileLoadMs,
        hasFileLoadOutliers,
        outliers,
        operations: [...knownOperations, ...outliers],
    };
}

function testDiscoveryAction(profile: NormalizedProfile, breakdown: TestDiscoveryBreakdown): string {
    const discoveryOnly = profile.operation === "readTests" || profile.operation === "cli:list-tests";
    const operationContext = discoveryOnly
        ? " This operation does not run tests, so reducing discovery directly reduces its total time."
        : "";
    const details =
        breakdown.hasFileLoadOutliers === undefined
            ? " Run with profiler.level 2 to check individual file-load outliers."
            : "";
    const largest = Math.max(
        breakdown.globWallMs,
        breakdown.fileLoadWallMs,
        breakdown.parseWallMs,
        breakdown.otherWallMs,
    );

    if (largest === breakdown.globWallMs && largest > 0) {
        return `File matching/glob is the largest component. Narrow files/sets masks and exclude generated or artifact directories that cannot contain tests.${operationContext}${details}`;
    }
    if (largest === breakdown.fileLoadWallMs && largest > 0) {
        if (breakdown.hasFileLoadOutliers) {
            return `Inspect the reported file-load outliers and their imports or file-read listeners. Move repeated initialization out of module scope or load heavy dependencies lazily.${operationContext}`;
        }
        if (breakdown.hasFileLoadOutliers === false) {
            const count = breakdown.fileCount === undefined ? "the selected files" : `${breakdown.fileCount} files`;
            return `No file was at least 3× slower than the average; the cost is distributed across ${count}. Narrow the selected files/sets or move repeated per-file initialization out of module scope.${operationContext}`;
        }
        return `Loading the selected files is the largest component.${details}${operationContext}`;
    }
    if (largest === breakdown.parseWallMs && largest > 0) {
        return `Grouping, parsing, or validation is the largest component. Reduce unnecessary browser/file combinations and inspect expensive test declaration or filtering logic.${operationContext}${details}`;
    }

    return `The retained components do not fully explain this phase. Set profiler.output and inspect its retained children.${operationContext}${details}`;
}

function majorPhaseFinding(profile: NormalizedProfile, operation: RetainedOperation): FindingDraft {
    const listeners = slowPhaseListeners(profile, operation);
    const observation = [
        `\`${operation.name}\` (${operation.process.type} process) took ${formatMs(
            operation.timing.wallMs,
        )} (${formatPercent(operation.timing.wallMs / profile.durationMs)} of the run).`,
        ...(listeners.length
            ? ["Slow listeners or callbacks inside this phase:", ...listeners.map(phaseListenerObservation)]
            : []),
    ].join("\n");
    const evidence: FindingEvidence[] = [
        {
            metric: "wall",
            value: operation.timing.wallMs,
            unit: "ms",
            threshold: ANALYSIS_POLICY_V1.majorPhase.minWallMs,
            operationId: operation.id,
        },
        {
            metric: "runShare",
            value: operation.timing.wallMs / profile.durationMs,
            unit: "ratio",
            threshold: ANALYSIS_POLICY_V1.majorPhase.minRunShare,
            operationId: operation.id,
        },
    ];
    for (const listener of listeners) {
        evidence.push(
            {
                metric: "phaseContributor",
                value: listener.name,
                operationId: listener.id,
            },
            {
                metric: "phaseContributorWall",
                value: listener.timing.wallMs,
                unit: "ms",
                operationId: listener.id,
            },
        );
        const source = formatSource(listener.source);
        if (source) {
            evidence.push({
                metric: "phaseContributorSource",
                value: source,
                operationId: listener.id,
            });
        }
        if (listener.timing.activeJsMs !== undefined) {
            evidence.push({
                metric: "phaseContributorActiveJs",
                value: listener.timing.activeJsMs,
                unit: "ms",
                operationId: listener.id,
            });
        }
        if (listener.timing.waitingMs !== undefined) {
            evidence.push({
                metric: "phaseContributorWaiting",
                value: listener.timing.waitingMs,
                unit: "ms",
                operationId: listener.id,
            });
        }
    }

    return {
        analyzer: { id: "major-phase-v1", version: 1 },
        category: "phase",
        severity: "warning",
        observation,
        evidence,
        action: majorPhaseAction(profile, operation, listeners),
        confidence: "high",
        operationIds: [operation.id, ...listeners.map(listener => listener.id)],
        entityIds: [operation.name],
    };
}

function slowPhaseListeners(profile: NormalizedProfile, phase: RetainedOperation): RetainedOperation[] {
    const operationsById = new Map(profile.timeline.map(operation => [operation.id, operation]));

    return profile.timeline
        .filter(
            operation =>
                (operation.kind === "event.listener" || operation.kind === "user.callback") &&
                !operation.name.startsWith("internal:"),
        )
        .filter(operation => hasAncestor(operation, phase.id, operationsById))
        .filter(
            operation =>
                operation.timing.wallMs >= ANALYSIS_POLICY_V1.majorPhase.minListenerWallMs &&
                operation.timing.wallMs / phase.timing.wallMs >= ANALYSIS_POLICY_V1.majorPhase.minListenerShare,
        )
        .sort((left, right) => right.timing.wallMs - left.timing.wallMs)
        .slice(0, ANALYSIS_POLICY_V1.majorPhase.maxListeners);
}

function hasAncestor(
    operation: RetainedOperation,
    ancestorId: string,
    operationsById: ReadonlyMap<string, RetainedOperation>,
): boolean {
    let parentId = operation.parentId;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
        if (parentId === ancestorId) {
            return true;
        }
        visited.add(parentId);
        parentId = operationsById.get(parentId)?.parentId;
    }
    return false;
}

function phaseListenerObservation(operation: RetainedOperation): string {
    const source = formatSource(operation.source);
    const location = source ? ` at \`${source}\`` : "";
    const type = operation.kind === "user.callback" ? "Callback" : "Listener";
    const process = ` (${operation.process.type} process)`;
    const timing =
        operation.timing.activeJsMs !== undefined && operation.timing.waitingMs !== undefined
            ? ` It spent ${formatMs(operation.timing.activeJsMs)} in active JS and ${formatMs(
                  operation.timing.waitingMs,
              )} waiting.`
            : "";
    return `• ${type} \`${operation.name}\`${process}${location} took ${formatMs(operation.timing.wallMs)}.${timing}`;
}

function majorPhaseAction(
    profile: NormalizedProfile,
    operation: RetainedOperation,
    listeners: RetainedOperation[],
): string {
    if (!listeners.length) {
        if (profile.level < 3) {
            return `Run with profiler.level ${profile.level + 1} to retain more child operations inside \`${
                operation.name
            }\`; the current profile does not identify a specific owner.`;
        }
        return `Set profiler.output and inspect unattributed time inside \`${operation.name}\`. No retained user-owned child materially explains this phase; if it stays slow without custom plugins, attach the profile to a Testplane issue.`;
    }

    return "Open the reported listener or callback sources, or locate their registrations by the displayed names. If active JS dominates, reduce synchronous or CPU-heavy work; if waiting dominates, inspect awaited I/O or timers. Parallelize only independent operations.";
}

function listenerFinding(
    aggregate: ProfilerAggregate,
    profile: NormalizedProfile,
    slowest: RetainedOperation | undefined,
    shortLocation: string | undefined,
): FindingDraft {
    const finding = aggregateFinding(
        "event-listener-v1",
        "event-listener",
        aggregate,
        profile,
        listenerAction(profile.level, aggregate.name, slowest, shortLocation),
    );
    if (!slowest) {
        return finding;
    }

    const source = formatSource(slowest?.source);
    const location = source ? ` at \`${source}\`` : " (source unavailable)";
    finding.observation += ` Slowest retained call${location} took ${formatMs(slowest.timing.wallMs)}.`;
    if (source) {
        finding.evidence.push({
            metric: "source",
            value: source,
            operationId: slowest.id,
        });
    }
    if (slowest.timing.activeJsMs !== undefined && slowest.timing.waitingMs !== undefined) {
        finding.evidence.push(
            {
                metric: "activeJs",
                value: slowest.timing.activeJsMs,
                unit: "ms",
                operationId: slowest.id,
            },
            {
                metric: "waiting",
                value: slowest.timing.waitingMs,
                unit: "ms",
                operationId: slowest.id,
            },
        );
    }
    return finding;
}

function listenerAction(
    level: NormalizedProfile["level"],
    name: string,
    operation: RetainedOperation | undefined,
    shortLocation: string | undefined,
): string {
    const owner = listenerOwner(name, shortLocation);
    const activeJsMs = operation?.timing.activeJsMs;
    const waitingMs = operation?.timing.waitingMs;

    if (activeJsMs === undefined || waitingMs === undefined) {
        return level < 3
            ? `${owner}: run with profiler.level 3 to see what happened during this listener call.`
            : `${owner}: the detailed activity breakdown was not retained; inspect what this listener does during its slow call.`;
    }
    if (waitingMs > activeJsMs) {
        return `${owner}: waiting dominates the slowest retained call; inspect awaited I/O or timers and remove avoidable serial waits.`;
    }
    if (activeJsMs > waitingMs) {
        return `${owner}: active JS dominates the slowest retained call; reduce synchronous CPU-heavy work or move it off the listener's critical path.`;
    }
    return `${owner}: active JS and waiting contribute equally; inspect both awaited I/O or timers and synchronous CPU-heavy work.`;
}

function listenerOwner(name: string, shortLocation: string | undefined): string {
    return `\`${name}\` (${shortLocation ?? "source unavailable"})`;
}

function shortestUniqueSourceLocations(sources: Array<RetainedOperation["source"]>): Array<string | undefined> {
    const paths = sources.map(source => source?.file?.replaceAll("\\", "/"));
    const uniquePaths = [...new Set(paths.filter((file): file is string => Boolean(file)))];
    const suffixCounts = new Map<string, number>();

    for (const file of uniquePaths) {
        const parts = file.split("/").filter(Boolean);
        for (let depth = 1; depth <= parts.length; depth += 1) {
            const suffix = parts.slice(-depth).join("/");
            suffixCounts.set(suffix, (suffixCounts.get(suffix) ?? 0) + 1);
        }
    }

    const suffixes = new Map(
        uniquePaths.map(file => {
            const parts = file.split("/").filter(Boolean);
            const suffix = parts
                .map((_, index) => parts.slice(-(index + 1)).join("/"))
                .find(candidate => suffixCounts.get(candidate) === 1);

            return [file, suffix ?? parts.join("/")] as const;
        }),
    );

    return sources.map((source, index) => {
        const file = paths[index];
        if (!file) {
            return;
        }
        const line = source?.line;
        const column = source?.column;

        return `${suffixes.get(file)}${line === undefined ? "" : `:${line}`}${
            column === undefined ? "" : `:${column}`
        }`;
    });
}

function testFileAction(profile: NormalizedProfile, operation: RetainedOperation): string {
    if (profile.level < 3) {
        return "Run with profiler.level 3 to identify heavy dependencies. If no slow dependency is reported, inspect synchronous or awaited module-scope initialization in this test file.";
    }

    const dependency = profile.timeline
        .filter(
            candidate =>
                candidate.kind === "module.load" &&
                candidate.attributes.ownerFile === operation.name &&
                candidate.name !== operation.name &&
                candidate.attributes.cacheHit !== true &&
                !isFrameworkModule(String(candidate.attributes.module ?? candidate.name)),
        )
        .sort((left, right) => right.timing.wallMs - left.timing.wallMs)[0];
    return dependency
        ? `Inspect \`${dependency.name}\`, the slowest retained uncached dependency of this file. Move heavy initialization out of module scope or load it lazily.`
        : "No slow dependency was retained for this file. Inspect synchronous or awaited module-scope initialization in the file itself.";
}

function moduleDependencyAction(ownerFile: string): string {
    return `In \`${ownerFile}\`, load this dependency lazily or import a lighter entry point. Reduce its initialization work if you own it. Reuse initialized state through the module cache only within the same worker process.`;
}

function commandFinding(aggregate: ProfilerAggregate, profile: NormalizedProfile): FindingDraft {
    const finding = aggregateFinding(
        "browser-command-v1",
        "browser-command",
        aggregate,
        profile,
        "Inspect the slowest retained calls and their test context. Reduce redundant calls or the work performed by each call; for wait-like commands, prefer a condition-based wait.",
    );
    const slowest = retainedOperationsForAggregate(profile, aggregate)[0];
    const context = slowest ? commandContext(profile, slowest) : "";
    const example = slowest ? ` Slowest retained call took ${formatMs(slowest.timing.wallMs)}${context}.` : "";
    const source = formatSource(slowest?.source);
    const registration = source ? ` It was registered at \`${source}\`.` : "";
    finding.observation = `\`${aggregate.name}\` used ${formatMs(aggregate.totalWallMs)} across ${
        aggregate.count
    } call(s) (${formatMs(aggregate.meanWallMs)} average).${example}${registration}`;
    if (source && slowest) {
        finding.evidence.push({
            metric: "source",
            value: source,
            operationId: slowest.id,
        });
    }
    return finding;
}

function commandContext(profile: NormalizedProfile, operation: RetainedOperation): string {
    const runnable = findAncestor(profile, operation, candidate =>
        [
            "test.body",
            "test.hook",
            "test.beforeEach.total",
            "test.afterEach.total",
            "worker.test-attempt",
            "test.attempt",
        ].includes(candidate.kind),
    );
    const test = runnable ? ` under \`${runnable.name}\`` : "";
    const browser = operation.context.browserId ? ` on \`${operation.context.browserId}\`` : "";
    return `${test}${browser}`;
}

function findAncestor(
    profile: NormalizedProfile,
    operation: RetainedOperation,
    matches: (candidate: RetainedOperation) => boolean,
): RetainedOperation | undefined {
    let parentId = operation.parentId;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = profile.timeline.find(candidate => candidate.id === parentId);
        if (!parent) {
            return;
        }
        if (matches(parent)) {
            return parent;
        }
        parentId = parent.parentId;
    }
    return;
}

function retainedOperationsForAggregate(profile: NormalizedProfile, aggregate: ProfilerAggregate): RetainedOperation[] {
    return profile.timeline
        .filter(operation => operation.kind === aggregate.kind && operation.name === aggregate.name)
        .sort((left, right) => right.timing.wallMs - left.timing.wallMs)
        .slice(0, 3);
}

function formatSource(source: RetainedOperation["source"]): string | undefined {
    const location = source?.file
        ? `${source.file}${source.line === undefined ? "" : `:${source.line}`}${
              source.column === undefined ? "" : `:${source.column}`
          }`
        : undefined;
    if (source?.plugin && location) {
        return `${source.plugin} (${location})`;
    }
    return location ?? source?.plugin;
}

const dedupeByNameMaxWall = (operations: RetainedOperation[]): RetainedOperation[] => {
    const byName = new Map<string, RetainedOperation>();
    for (const operation of operations) {
        const existing = byName.get(operation.name);
        if (!existing || operation.timing.wallMs > existing.timing.wallMs) {
            byName.set(operation.name, operation);
        }
    }
    return [...byName.values()];
};

const isFrameworkModule = (modulePath: string): boolean => modulePath.includes("node_modules/testplane/");

const operationUnionWall = (profile: NormalizedProfile, aggregate: ProfilerAggregate): number =>
    unionDuration(
        profile.timeline
            .filter(operation => operation.kind === aggregate.kind && operation.name === aggregate.name)
            .map(operation => [operation.startOffsetMs, operation.startOffsetMs + operation.timing.wallMs] as const),
    );

const sampledAggregateValue = (
    profile: NormalizedProfile,
    name: string,
    field: "p50WallMs" | "p95WallMs",
    attributes: Record<string, ProfilerValue> = {},
): number | undefined => {
    const aggregate = findAggregate(profile, name, attributes);
    return (aggregate?.count ?? 0) >= ANALYSIS_POLICY_V1.resources.minSamples ? aggregate?.[field] : undefined;
};

const findAggregate = (
    profile: NormalizedProfile,
    name: string,
    attributes: Record<string, ProfilerValue> = {},
): ProfilerAggregate | undefined =>
    profile.aggregates.byKind.find(
        aggregate =>
            aggregate.kind === "metric.sample" &&
            aggregate.name === name &&
            Object.entries(attributes).every(([key, value]) => aggregate.attributes?.[key] === value),
    );

const formatMs = (milliseconds: number): string =>
    milliseconds >= 1000 ? `${(milliseconds / 1000).toFixed(1)}s` : `${milliseconds.toFixed(0)}ms`;

const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`;
