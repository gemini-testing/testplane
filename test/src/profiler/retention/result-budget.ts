import { RETENTION_POLICY_V1 } from "src/profiler/retention/policy-v1";
import { enforceSerializedResultBudget } from "src/profiler/retention/result-budget";
import type { ProfilerResultV1 } from "src/profiler/schema";

describe("profiler/retention/result-budget", () => {
    const makeResult = (): ProfilerResultV1 => ({
        schemaVersion: 1,
        run: {
            id: "run",
            level: 1,
            operation: "run",
            profileStatus: "complete",
            runOutcome: "passed",
            startedAt: new Date(0).toISOString(),
            durationMs: 100,
            partialReasons: [],
        },
        environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            availableParallelism: 1,
        },
        capabilities: {
            processCpu: "available",
            threadCpu: "available",
            eventLoop: "available",
            asyncActivity: "disabled",
            moduleGraph: "disabled",
            browserTelemetry: "disabled",
        },
        timeline: [],
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
        dataQuality: {
            clock: { unalignedFragments: 0 },
            coverage: [],
        },
        profiler: {
            collectionErrors: [],
            truncation: [],
            inRunOverheadEstimateMs: 0,
        },
    });

    it("should preserve a result that already fits", () => {
        const result = makeResult();

        assert.strictEqual(enforceSerializedResultBudget(1, result), result);
    });

    it("should bound the whole serialized result and retain the most expensive aggregates", () => {
        const result = makeResult();
        result.aggregates.listeners = Array.from({ length: 2_000 }, (_, index) => ({
            kind: "event.listener",
            name: `${index}-${"x".repeat(1_000)}`,
            count: 1,
            totalWallMs: index,
            minWallMs: index,
            maxWallMs: index,
            meanWallMs: index,
        }));

        const bounded = enforceSerializedResultBudget(1, result);
        const size = Buffer.byteLength(JSON.stringify(bounded));
        const marker = bounded.profiler.truncation.find(entry => entry.collector === "serialized-result-budget");

        assert.isAtMost(size, RETENTION_POLICY_V1.serializedResultBudgetBytes[1]);
        assert.isBelow(bounded.aggregates.listeners.length, result.aggregates.listeners.length);
        assert.equal(bounded.aggregates.listeners[0].totalWallMs, 1_999);
        assert.deepInclude(marker, { truncated: true });
        assert.isBelow(marker!.retained, marker!.seen);
    });

    it("should bound oversized diagnostics and retain the result-budget marker", () => {
        const result = makeResult();
        result.profiler.truncation = Array.from({ length: 2_000 }, (_, index) => ({
            collector: `collector-${index}`,
            seen: 1,
            retained: 1,
            rule: "x".repeat(1_000),
            truncated: false,
        }));

        const bounded = enforceSerializedResultBudget(1, result);

        assert.isAtMost(Buffer.byteLength(JSON.stringify(bounded)), RETENTION_POLICY_V1.serializedResultBudgetBytes[1]);
        assert.isTrue(bounded.profiler.truncation.some(entry => entry.collector === "serialized-result-budget"));
    });
});
