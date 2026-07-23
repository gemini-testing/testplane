/* eslint-disable no-use-before-define -- compact synthetic fixtures are declared below their assertions */

import { aggregateProfile, unionDuration } from "src/profiler/analysis/aggregator";
import { compactProfileReferences } from "src/profiler/analysis/compact";
import type { EnabledProfilerLevel, Finding, RetainedOperation } from "src/profiler/schema";
import type { RuntimeAggregate, RuntimeSnapshot } from "src/profiler/runtime/types";

describe("profiler/analysis", () => {
    const operation = (id: string, startOffsetMs: number, wallMs: number): RetainedOperation => ({
        id,
        kind: "test.attempt",
        name: id,
        process: { type: "master" },
        context: { runId: "run" },
        startOffsetMs,
        timing: { wallMs },
        attributes: {},
        quality: { timing: "exact", cpu: "unavailable" },
    });

    it("should compact every public operation reference and remove repeated run ids from contexts", () => {
        const root = {
            ...operation("run-id:operation", 0, 100),
            kind: "testplane.operation",
            context: { runId: "run-id", spanId: "run-id:operation" },
        };
        const child = {
            ...operation("run-id:worker:1:span:1", 10, 20),
            parentId: root.id,
            context: { runId: "run-id", spanId: "run-id:worker:1:span:1" },
        };
        const finding: Finding = {
            id: "finding",
            analyzer: { id: "test-v1", version: 1 },
            category: "test",
            severity: "warning",
            observation: "slow",
            evidence: [{ metric: "wall", value: 20, operationId: child.id }],
            action: "inspect",
            confidence: "high",
            operationIds: [child.id],
        };

        const compact = compactProfileReferences([child, root], [finding]);

        assert.deepEqual(
            compact.timeline.map(item => item.id),
            ["op:1", "op:0"],
        );
        assert.equal(compact.timeline[0].parentId, "op:0");
        assert.notProperty(compact.timeline[0].context, "runId");
        assert.notProperty(compact.timeline[1].context, "runId");
        assert.equal(compact.timeline[0].context.spanId, "op:1");
        assert.equal(compact.timeline[1].context.spanId, "op:0");
        assert.deepEqual(compact.findings[0].operationIds, ["op:1"]);
        assert.equal(compact.findings[0].evidence[0].operationId, "op:1");
    });

    it("should calculate wall, cumulative work and overlap from interval unions", () => {
        const profile = aggregateProfile(
            {
                runId: "run",
                level: 2,
                originEpochMs: 0,
                operations: [operation("first", 0, 80), operation("second", 20, 80)],
                aggregates: [],
                metrics: [],
                errors: [],
                truncation: [],
                overheadMs: 0,
                clock: { unalignedFragments: 0 },
            },
            100,
        );
        const root = profile.timeline.find(item => item.kind === "testplane.operation");

        assert.equal(root!.timing.wallMs, 100);
        assert.equal(root!.timing.cumulativeWorkMs, 160);
        assert.equal(root!.timing.overlapMs, 60);
        assert.equal(root!.timing.selfWallMs, 0);
    });

    it("should merge touching and overlapping intervals", () => {
        assert.equal(
            unionDuration([
                [0, 10],
                [5, 20],
                [20, 25],
                [30, 35],
            ]),
            30,
        );
    });

    it("should report and repair missing parents", () => {
        const child = { ...operation("child", 0, 10), parentId: "missing" };
        const profile = aggregateProfile(
            {
                runId: "run",
                level: 1,
                originEpochMs: 0,
                operations: [child],
                aggregates: [],
                metrics: [],
                errors: [],
                truncation: [],
                overheadMs: 0,
                clock: { unalignedFragments: 0 },
            },
            10,
        );

        assert.equal(profile.errors[0].code, "MISSING_PARENT");
        assert.equal(profile.timeline.find(item => item.id === "child")!.parentId, "run:operation");
    });

    it("should reject cyclic parent edges without losing operations", () => {
        const first = { ...operation("first", 0, 10), parentId: "second" };
        const second = { ...operation("second", 0, 10), parentId: "first" };
        const profile = aggregateProfile(snapshot({ level: 2, operations: [first, second] }), 20);

        assert.equal(profile.errors.filter(error => error.code === "CYCLE").length, 1);
        assert.lengthOf(
            profile.timeline.filter(item => item.id === "first" || item.id === "second"),
            2,
        );
    });

    it("should compute self time from the observed child union when child detail was truncated", () => {
        const parent = {
            ...operation("parent", 0, 100),
            timing: { wallMs: 100, observedChildUnionMs: 90 },
        };
        const child = {
            ...operation("child", 0, 10),
            kind: "test.body",
            parentId: "parent",
        };
        const profile = aggregateProfile(snapshot({ level: 2, operations: [parent, child] }), 100);

        assert.equal(profile.timeline.find(item => item.id === "parent")!.timing.selfWallMs, 10);
        const unattributed = profile.timeline.find(
            item => item.kind === "testplane.phase.unattributed" && item.parentId === "parent",
        );
        assert.equal(unattributed!.attributes.retentionAffected, true);
    });

    it("should expose root command wall separately from nested cumulative work", () => {
        const profile = aggregateProfile(
            {
                ...snapshot({ level: 3, operations: [] }),
                aggregates: [
                    runtimeAggregate("browser.command.root", "<root>", {
                        count: 2,
                        total: 120,
                    }),
                    runtimeAggregate("browser.command.cumulative", "<all>", {
                        count: 4,
                        total: 190,
                    }),
                    runtimeAggregate("browser.command", "pause", { count: 2, total: 70 }),
                ],
            },
            200,
        );

        const summary = profile.aggregates.commands.find(item => item.name === "<root>");

        assert.deepInclude(summary, {
            kind: "browser.command",
            count: 2,
            totalWallMs: 120,
            cumulativeWorkMs: 190,
            overlapMs: 70,
        });
        assert.isUndefined(profile.aggregates.byKind.find(item => item.kind.startsWith("browser.")));
        assert.isUndefined(profile.aggregates.browsers.find(item => item.kind.startsWith("browser.command")));
        assert.deepEqual(profile.aggregates.commands.map(item => item.name).sort(), ["<root>", "pause"]);
    });

    it("should keep non-command browser aggregates only under browsers", () => {
        const profile = aggregateProfile(
            {
                ...snapshot({ level: 2, operations: [] }),
                aggregates: [
                    runtimeAggregate("browser.session.acquire", "chrome", {
                        count: 3,
                        total: 900,
                    }),
                    runtimeAggregate("browser.pool.wait", "chrome", {
                        count: 2,
                        total: 400,
                    }),
                    runtimeAggregate("browser.command", "url", { count: 1, total: 50 }),
                    runtimeAggregate("worker.startup", "worker-1", {
                        count: 1,
                        total: 80,
                    }),
                ],
            },
            200,
        );

        assert.deepEqual(profile.aggregates.browsers.map(item => item.kind).sort(), [
            "browser.pool.wait",
            "browser.session.acquire",
        ]);
        assert.deepEqual(
            profile.aggregates.commands.map(item => item.name),
            ["url"],
        );
        assert.deepEqual(
            profile.aggregates.byKind.map(item => item.kind),
            ["worker.startup"],
        );
    });
});

const snapshot = ({
    level,
    operations,
}: {
    level: EnabledProfilerLevel;
    operations: RetainedOperation[];
}): RuntimeSnapshot => ({
    runId: "run",
    level,
    originEpochMs: 0,
    operations,
    aggregates: [],
    metrics: [],
    errors: [],
    truncation: [],
    overheadMs: 0,
    clock: { unalignedFragments: 0 },
});

const runtimeAggregate = (
    kind: string,
    name: string,
    { count, total }: { count: number; total: number },
): RuntimeAggregate => ({
    kind,
    name,
    statistics: {
        count,
        sum: total,
        min: total / count,
        max: total / count,
        mean: total / count,
        variance: 0,
        p50: total / count,
        p95: total / count,
        samples: [total / count],
    },
});
