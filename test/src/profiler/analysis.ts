/* eslint-disable no-use-before-define -- compact synthetic fixtures are declared below their assertions */

import { aggregateProfile, unionDuration, type NormalizedProfile } from "src/profiler/analysis/aggregator";
import { runAnalyzers } from "src/profiler/analysis/analyzers";
import { compactProfileReferences } from "src/profiler/analysis/compact";
import type {
    EnabledProfilerLevel,
    Finding,
    ProfilerAggregate,
    ProfilerOperationName,
    ProfilerValue,
    RetainedOperation,
} from "src/profiler/schema";
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

    it("should not warn about unattributed time that is a retention artifact", () => {
        const child = {
            ...operation("child", 0, 10_000),
            kind: "test.body",
            parentId: "parent",
        };
        const truncatedParent = {
            ...operation("parent", 0, 100_000),
            timing: { wallMs: 100_000, observedChildUnionMs: 50_000 },
        };
        const suppressed = aggregateProfile(snapshot({ level: 2, operations: [truncatedParent, child] }), 100_000);
        assert.notExists(runAnalyzers(suppressed).find(item => item.analyzer.id === "unattributed-v1"));

        const genuineParent = {
            ...operation("parent", 0, 100_000),
            timing: { wallMs: 100_000 },
        };
        const genuine = aggregateProfile(snapshot({ level: 2, operations: [genuineParent, child] }), 100_000);
        assert.exists(runAnalyzers(genuine).find(item => item.analyzer.id === "unattributed-v1"));

        const next = {
            ...operation("next", 90_000, 10_000),
            kind: "browser.command",
            parentId: "parent",
        };
        const detailed = aggregateProfile(snapshot({ level: 3, operations: [genuineParent, child, next] }), 100_000);
        const finding = runAnalyzers(detailed).find(item => item.analyzer.id === "unattributed-v1")!;
        assert.include(finding.observation, "inside `parent`");
        assert.include(finding.observation, "between test body `child` and browser command `next`");
        assert.include(finding.action, "between test body `child` and browser command `next`");
        assert.include(finding.action, "synchronous filesystem or CPU work");
        assert.deepInclude(finding.evidence, {
            metric: "parentPhase",
            value: "parent",
        });
        assert.deepInclude(finding.evidence, {
            metric: "previousOperation",
            value: "child",
            operationId: "child",
        });
        assert.deepInclude(finding.evidence, {
            metric: "nextOperation",
            value: "next",
            operationId: "next",
        });
    });

    it("should not flag the execution phase for dominating the run, but still flag setup phases", () => {
        const phaseOp = (kind: string, name: string, wallMs: number): RetainedOperation => ({
            id: kind,
            kind,
            name,
            process: { type: "master" },
            context: { runId: "run" },
            startOffsetMs: 0,
            timing: { wallMs },
            attributes: {},
            quality: { timing: "exact", cpu: "process-window" },
        });
        const profile = normalizedProfile({
            level: 1,
            durationMs: 100_000,
            timeline: [
                phaseOp("testplane.phase.execution", "Execute tests", 99_000),
                phaseOp("testplane.phase.init", "Initialize", 20_000),
            ],
        });

        const findings = runAnalyzers(profile).filter(item => item.analyzer.id === "major-phase-v1");
        assert.lengthOf(findings, 1);
        assert.include(findings[0].observation, "Initialize");

        const listener = {
            ...operation("listener", 1_000, 15_000),
            parentId: "testplane.phase.init",
            kind: "event.listener",
            name: "init:startServer",
            timing: { wallMs: 15_000, activeJsMs: 2_000, waitingMs: 13_000 },
            source: {
                file: "plugins/server/index.js",
                line: 42,
                confidence: "high" as const,
            },
        };
        const fileInsidePhase = {
            ...operation("file", 30_000, 10_000),
            parentId: "testplane.phase.init",
            kind: "test.file.load",
            name: "nested.hermione.ts",
        };
        const dependencyInsidePhase = {
            ...operation("dependency", 40_000, 10_000),
            parentId: "testplane.phase.init",
            kind: "module.load",
            name: "heavy-dependency",
            attributes: {
                module: "heavy-dependency",
                ownerFile: "nested.hermione.ts",
                cacheHit: false,
            },
        };
        const detailed = normalizedProfile({
            level: 3,
            durationMs: 100_000,
            timeline: [...profile.timeline, listener, fileInsidePhase, dependencyInsidePhase],
        });
        const detailedFinding = runAnalyzers(detailed).find(item => item.analyzer.id === "major-phase-v1")!;
        assert.include(detailedFinding.observation, "`Initialize` (master process) took");
        assert.include(detailedFinding.observation, "Slow listeners or callbacks inside this phase");
        assert.include(detailedFinding.observation, "Listener `init:startServer` (master process)");
        assert.include(detailedFinding.observation, "plugins/server/index.js:42");
        assert.include(detailedFinding.observation, "13.0s waiting");
        assert.notInclude(detailedFinding.observation, "nested.hermione.ts");
        assert.notInclude(detailedFinding.observation, "heavy-dependency");
        assert.include(detailedFinding.action, "awaited I/O or timers");
        assert.notInclude(detailedFinding.action, "files");
        assert.notInclude(detailedFinding.action, "dependencies");
        assert.notInclude(detailedFinding.action, "hooks");
        assert.notInclude(detailedFinding.action, "commands");
        assert.deepEqual(detailedFinding.operationIds, ["testplane.phase.init", "listener"]);

        const workerPhase = {
            ...profile.timeline[1],
            id: "worker-init",
            process: { type: "worker" as const },
        };
        const workerListener = {
            ...listener,
            id: "worker-listener",
            parentId: workerPhase.id,
            name: "init:startWorker",
            kind: "user.callback",
            process: { type: "worker" as const },
        };
        const workerProfile = normalizedProfile({
            level: 3,
            durationMs: 100_000,
            timeline: [workerPhase, workerListener],
        });
        const workerFinding = runAnalyzers(workerProfile).find(item => item.analyzer.id === "major-phase-v1")!;
        assert.include(workerFinding.observation, "`Initialize` (worker process) took");
        assert.include(workerFinding.observation, "Callback `init:startWorker` (worker process)");
    });

    it("should advise chunks for a long CPU-saturated run and more parallelism otherwise", () => {
        const durationMs = 20 * 60 * 1000 + 1;
        const cpuAggregate = aggregate("metric.sample", "host.cpuUtilization", {
            count: 100,
            p95: 0.9,
            attributes: { process: "host" },
        });
        const profile = normalizedProfile({
            level: 1,
            durationMs,
            byKind: [cpuAggregate],
        });

        const saturated = runAnalyzers(profile).find(item => item.analyzer.id === "long-run-v1")!;
        assert.include(saturated.observation, "longer than the 20-minute threshold");
        assert.include(saturated.observation, "Host CPU p95 was 90%");
        assert.include(saturated.action, "@testplane/chunks");
        assert.include(saturated.action, "parallel");
        assert.notInclude(saturated.action, "system.workers");
        assert.deepInclude(saturated.evidence, {
            metric: "wall",
            value: durationMs,
            unit: "ms",
            threshold: 20 * 60 * 1000,
        });

        cpuAggregate.p95WallMs = 0.4;
        const withCpuHeadroom = runAnalyzers(profile).find(item => item.analyzer.id === "long-run-v1")!;
        assert.include(withCpuHeadroom.observation, "Host CPU p95 was 40%");
        assert.include(withCpuHeadroom.action, "sessionsPerBrowser");
        assert.notInclude(withCpuHeadroom.action, "system.workers");
        assert.notInclude(withCpuHeadroom.action, "@testplane/chunks");

        profile.aggregates.byKind = [];
        const withoutCpuData = runAnalyzers(profile).find(item => item.analyzer.id === "long-run-v1")!;
        assert.include(withoutCpuData.observation, "Host CPU utilization data was unavailable");
        assert.include(withoutCpuData.action, "Check host CPU");
        assert.notInclude(withoutCpuData.action, "@testplane/chunks");

        profile.operation = "cli:list-tests";
        assert.notExists(runAnalyzers(profile).find(item => item.analyzer.id === "long-run-v1"));

        profile.operation = "run";
        profile.durationMs = 20 * 60 * 1000;
        assert.notExists(runAnalyzers(profile).find(item => item.analyzer.id === "long-run-v1"));
    });

    it("should explain slow test discovery by component, file average and 3x outliers", () => {
        const phase = {
            ...operation("discovery", 0, 9_000),
            kind: "testplane.phase.test-discovery",
            name: "Discover and load test files",
        };
        const component = (id: string, kind: string, startOffsetMs: number, wallMs: number): RetainedOperation => ({
            ...operation(id, startOffsetMs, wallMs),
            parentId: phase.id,
            kind,
            name: id,
        });
        const glob = component("glob", "sets.resolve-and-glob", 0, 6_000);
        const load = {
            ...component("load", "files.load", 6_000, 2_500),
            attributes: { files: 1_000 },
        };
        const parse = component("parse", "tests.parse", 8_500, 500);
        const slowFile = {
            ...component("slow-file", "test.file.load", 6_100, 30),
            parentId: load.id,
            name: "test/slow.testplane.ts",
        };
        const fileSummary = aggregate("test.file.load.summary", "master", {
            count: 1_000,
            total: 2_000,
            max: 30,
            attributes: { process: "master" },
        });
        const profile = normalizedProfile({
            operation: "cli:list-tests",
            level: 2,
            durationMs: 10_000,
            timeline: [phase, glob, load, parse, slowFile],
            testFiles: [fileSummary],
        });

        const finding = runAnalyzers(profile).find(item => item.analyzer.id === "test-discovery-v1")!;

        assert.include(finding.observation, "does not execute tests");
        assert.include(finding.action, "File matching/glob is the largest component");
        assert.deepInclude(finding.evidence, { metric: "fileCount", value: 1_000 });
        assert.deepInclude(finding.evidence, {
            metric: "averageFileLoad",
            value: 2,
            unit: "ms",
        });
        assert.deepInclude(finding.evidence, {
            metric: "hasFileLoadOutliers",
            value: true,
        });
        assert.deepInclude(finding.evidence, {
            metric: "fileLoadOutlier",
            value: "test/slow.testplane.ts",
            operationId: slowFile.id,
        });
        assert.notExists(runAnalyzers(profile).find(item => item.analyzer.id === "major-phase-v1"));

        glob.timing.wallMs = 1_000;
        load.startOffsetMs = 1_000;
        load.timing.wallMs = 7_000;
        parse.startOffsetMs = 8_000;
        parse.timing.wallMs = 1_000;
        fileSummary.maxWallMs = 5;
        slowFile.timing.wallMs = 5;
        assert.include(
            runAnalyzers(profile).find(item => item.analyzer.id === "test-discovery-v1")!.action,
            "No file was at least 3× slower than the average",
        );
    });

    it("should report a repeatedly loaded test file only once", () => {
        const fileOp = (wallMs: number, index: number): RetainedOperation => ({
            id: `file-${index}`,
            kind: "test.file.load",
            name: "testplane-tests/suite.testplane.ts",
            process: { type: "worker" },
            context: { runId: "run" },
            startOffsetMs: 0,
            timing: { wallMs },
            attributes: {},
            quality: { timing: "exact", cpu: "unavailable" },
        });
        const profile = normalizedProfile({
            level: 2,
            durationMs: 10_000,
            timeline: [1_600, 1_500, 1_500, 1_400, 1_300].map(fileOp),
        });

        const findings = runAnalyzers(profile).filter(item => item.analyzer.id === "test-file-v1");
        assert.lengthOf(findings, 1);
        assert.include(findings[0].observation, "suite.testplane.ts");
        assert.include(findings[0].action, "profiler.level 3");
        assert.include(findings[0].action, "module-scope initialization");

        const dependency = {
            ...fileOp(800, 6),
            id: "dependency",
            kind: "module.load",
            name: "node_modules/heavy-dep/index.js",
            attributes: {
                module: "node_modules/heavy-dep/index.js",
                ownerFile: "testplane-tests/suite.testplane.ts",
                cacheHit: false,
            },
        };
        const detailed = normalizedProfile({
            level: 3,
            durationMs: 10_000,
            timeline: [...profile.timeline, dependency],
        });
        assert.include(runAnalyzers(detailed).find(item => item.analyzer.id === "test-file-v1")!.action, "heavy-dep");

        const detailedWithoutDependency = normalizedProfile({
            level: 3,
            durationMs: 10_000,
            timeline: [
                ...profile.timeline,
                {
                    ...fileOp(1_000, 7),
                    id: "test-file-self-module",
                    kind: "module.load",
                    attributes: {
                        module: "testplane-tests/suite.testplane.ts",
                        ownerFile: "testplane-tests/suite.testplane.ts",
                        cacheHit: false,
                    },
                },
            ],
        });
        assert.include(
            runAnalyzers(detailedWithoutDependency).find(item => item.analyzer.id === "test-file-v1")!.action,
            "No slow dependency was retained",
        );
    });

    it("should exclude testplane internals and report a real dependency once", () => {
        const moduleOp = (name: string, wallMs: number, index: number): RetainedOperation => ({
            id: `${name}-${index}`,
            kind: "module.load",
            name,
            process: { type: "worker" },
            context: { runId: "run" },
            startOffsetMs: 0,
            timing: { wallMs },
            attributes: {
                module: name,
                ownerFile: "testplane-tests/suite.testplane.ts",
                cacheHit: false,
            },
            quality: { timing: "exact", cpu: "thread" },
        });
        const profile = normalizedProfile({
            level: 3,
            durationMs: 10_000,
            timeline: [
                moduleOp("node_modules/testplane/build/src/testplane.js", 800, 0),
                moduleOp("node_modules/testplane/build/src/testplane.js", 700, 1),
                moduleOp("node_modules/heavy-dep/index.js", 500, 0),
                moduleOp("node_modules/heavy-dep/index.js", 450, 1),
            ],
        });

        const findings = runAnalyzers(profile).filter(item => item.analyzer.id === "module-dependency-v1");
        assert.lengthOf(findings, 1);
        assert.include(findings[0].observation, "heavy-dep");
        assert.include(findings[0].action, "suite.testplane.ts");
        assert.include(findings[0].action, "same worker process");
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
        assert.notExists(runAnalyzers(profile).find(item => item.observation.includes("<root>")));
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

    it("should flag an event listener only when it is slow per call, not merely frequent", () => {
        const listener = {
            ...operation("listener", 0, 4_000),
            kind: "event.listener",
            name: "INIT:startServer",
            timing: { wallMs: 4_000, activeJsMs: 3_500, waitingMs: 500 },
            source: {
                file: "plugins/server/index.js",
                line: 42,
                functionName: "startServer",
                plugin: "server",
                confidence: "high" as const,
            },
        };
        const profile = normalizedProfile({
            level: 3,
            durationMs: 100_000,
            timeline: [listener],
            listeners: [
                aggregate("event.listener", "NEW_BROWSER:prepareBrowser", {
                    count: 388,
                    total: 9_400,
                    max: 60,
                }),
                aggregate("event.listener", "INIT:startServer", {
                    count: 2,
                    total: 6_000,
                    max: 4_000,
                }),
            ],
        });

        const findings = runAnalyzers(profile).filter(item => item.analyzer.id === "event-listener-v1");
        assert.lengthOf(findings, 1);
        assert.include(findings[0].observation, "startServer");
        assert.include(findings[0].observation, "server (plugins/server/index.js:42)");
        assert.notInclude(findings[0].observation, "in active JS");
        assert.include(findings[0].action, "`INIT:startServer` (index.js:42)");
        assert.include(findings[0].action, "active JS dominates");
        assert.include(findings[0].action, "CPU-heavy work");
        assert.notInclude(findings[0].action, "awaited I/O");
        assert.deepEqual(findings[0].operationIds, ["listener"]);
        assert.deepInclude(findings[0].evidence, {
            metric: "activeJs",
            value: 3_500,
            unit: "ms",
            operationId: "listener",
        });
    });

    it("should direct a waiting event listener to awaited I/O instead of CPU work", () => {
        const listener = {
            ...operation("listener", 0, 4_000),
            kind: "event.listener",
            name: "INIT:startServer",
            timing: { wallMs: 4_000, activeJsMs: 0, waitingMs: 4_000 },
        };
        const profile = normalizedProfile({
            level: 3,
            durationMs: 20_000,
            timeline: [listener],
            listeners: [
                aggregate("event.listener", "INIT:startServer", {
                    total: 4_000,
                    max: 4_000,
                }),
            ],
        });

        const finding = runAnalyzers(profile).find(item => item.analyzer.id === "event-listener-v1")!;

        assert.include(finding.action, "`INIT:startServer` (source unavailable)");
        assert.include(finding.action, "waiting dominates");
        assert.include(finding.action, "awaited I/O or timers");
        assert.notInclude(finding.action, "CPU-heavy work");
    });

    it("should flag a sub-second event listener when it materially affects a short run", () => {
        const profile = normalizedProfile({
            level: 2,
            durationMs: 1_000,
            listeners: [
                aggregate("event.listener", "INIT:startServer", {
                    total: 180,
                    max: 180,
                }),
            ],
        });

        const finding = runAnalyzers(profile).find(item => item.analyzer.id === "event-listener-v1")!;

        assert.include(finding.observation, "`INIT:startServer` used 180ms");
        assert.include(finding.action, "`INIT:startServer` (source unavailable)");
        assert.include(finding.action, "run with profiler.level 3");
        assert.notInclude(finding.action, "CPU-heavy");
        assert.notInclude(finding.action, "awaited I/O");
    });

    it("should disambiguate listener sources with the same file name", () => {
        const listeners = [
            {
                ...operation("first-listener", 0, 4_000),
                kind: "event.listener",
                name: "INIT:first",
                timing: { wallMs: 4_000, activeJsMs: 4_000, waitingMs: 0 },
                source: {
                    file: "plugins/foo/index.js",
                    line: 6,
                    column: 15,
                    confidence: "high" as const,
                },
            },
            {
                ...operation("second-listener", 4_000, 4_000),
                kind: "event.listener",
                name: "INIT:second",
                timing: { wallMs: 4_000, activeJsMs: 4_000, waitingMs: 0 },
                source: {
                    file: "plugins/bar/index.js",
                    line: 8,
                    column: 20,
                    confidence: "high" as const,
                },
            },
        ];
        const profile = normalizedProfile({
            level: 3,
            durationMs: 20_000,
            timeline: listeners,
            listeners: [
                aggregate("event.listener", "INIT:first", { total: 4_000, max: 4_000 }),
                aggregate("event.listener", "INIT:second", {
                    total: 4_000,
                    max: 4_000,
                }),
            ],
        });

        const findings = runAnalyzers(profile).filter(item => item.analyzer.id === "event-listener-v1");

        assert.lengthOf(findings, 2);
        assert.include(findings[0].action, "`INIT:first` (foo/index.js:6:15)");
        assert.include(findings[1].action, "`INIT:second` (bar/index.js:8:20)");
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

interface AggregateOptions {
    count?: number;
    total?: number;
    max?: number;
    p50?: number;
    p95?: number;
    attributes?: Record<string, ProfilerValue>;
}

const aggregate = (
    kind: string,
    name: string,
    { count = 1, total = 0, max = total, p50, p95, attributes }: AggregateOptions = {},
): ProfilerAggregate => ({
    kind,
    name,
    count,
    totalWallMs: total,
    minWallMs: count ? total / count : 0,
    maxWallMs: max,
    meanWallMs: count ? total / count : 0,
    p50WallMs: p50,
    p95WallMs: p95,
    cumulativeWorkMs: total,
    attributes,
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

const normalizedProfile = ({
    operation: profilerOperation = "run",
    level,
    durationMs,
    timeline = [],
    byKind = [],
    testFiles = [],
    commands = [],
    tests = [],
    hooks = [],
    listeners = [],
    metrics = [],
}: {
    operation?: ProfilerOperationName;
    level: EnabledProfilerLevel;
    durationMs: number;
    timeline?: RetainedOperation[];
    byKind?: ProfilerAggregate[];
    testFiles?: ProfilerAggregate[];
    commands?: ProfilerAggregate[];
    tests?: ProfilerAggregate[];
    hooks?: ProfilerAggregate[];
    listeners?: ProfilerAggregate[];
    metrics?: NormalizedProfile["aggregates"]["metrics"];
}): NormalizedProfile => ({
    runId: "run",
    operation: profilerOperation,
    level,
    durationMs,
    timeline,
    aggregates: {
        byKind,
        phases: [],
        listeners,
        testFiles,
        tests,
        hooks,
        commands,
        workers: [],
        browsers: [],
        metrics,
    },
    errors: [],
    truncation: [],
    overheadMs: 0,
    clock: { unalignedFragments: 0 },
});
