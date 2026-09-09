import chalk from "chalk";
import sinon from "sinon";

import { printProfilerResult } from "src/profiler/output/console";
import type { Finding, ProcessRef, ProfilerConfidence, ProfilerResultV1, RetainedOperation } from "src/profiler/schema";

describe("profiler/output/console", () => {
    const sandbox = sinon.createSandbox();
    const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
    const withoutColors = (value: string): string => value.replace(ansiPattern, "");

    afterEach(() => sandbox.restore());

    const finding = (
        analyzerId: string,
        confidence: ProfilerConfidence,
        totalWallMs: number,
        entity: string,
        count = 1,
    ): Finding => ({
        id: analyzerId,
        analyzer: { id: analyzerId, version: 1 },
        category: "test",
        severity: "warning",
        observation: `\`${entity}\` used ${(totalWallMs / 1000).toFixed(1)}s across ${count} call(s).`,
        evidence: [
            { metric: "count", value: count },
            { metric: "totalWall", value: totalWallMs, unit: "ms" },
        ],
        action: "Inspect it.",
        confidence,
        operationIds: [],
        entityIds: [entity],
    });

    const makeResult = ({
        findings = [],
        timeline = [],
        durationMs = 100_000,
    }: {
        findings?: Finding[];
        timeline?: RetainedOperation[];
        durationMs?: number;
    } = {}): ProfilerResultV1 => ({
        schemaVersion: 1,
        run: {
            id: "run",
            level: 1,
            operation: "run",
            profileStatus: "complete",
            runOutcome: "passed",
            startedAt: new Date(0).toISOString(),
            durationMs,
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
        timeline,
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
        findings,
        dataQuality: { clock: { unalignedFragments: 0 }, coverage: [] },
        profiler: { collectionErrors: [], truncation: [], inRunOverheadEstimateMs: 0 },
    });

    const phaseTimeline = (
        phases: Array<{ name: string; wallMs: number; type?: ProcessRef["type"] }>,
        durationMs: number,
    ): RetainedOperation[] => {
        const root: RetainedOperation = {
            id: "op:0",
            kind: "testplane.operation",
            name: "op",
            process: { type: "master" },
            context: {},
            startOffsetMs: 0,
            timing: { wallMs: durationMs },
            attributes: {},
            quality: { timing: "exact", cpu: "process-window" },
        };
        return [
            root,
            ...phases.map(({ name, wallMs, type = "master" }, index) => ({
                ...root,
                id: `op:${index + 1}`,
                parentId: root.id,
                kind: "testplane.phase.example",
                name,
                process: { type },
                timing: { wallMs },
            })),
        ];
    };

    const render = (result: ProfilerResultV1): string => {
        const logs: string[] = [];
        const warnings: string[] = [];
        printProfilerResult(result, {
            log: message => logs.push(message),
            warn: message => warnings.push(message),
        });
        assert.isEmpty(warnings);
        assert.lengthOf(logs, 1);
        return logs[0];
    };

    const withColors = <T>(action: () => T): T => {
        const enabled = chalk.enabled;
        const level = chalk.level;
        chalk.enabled = true;
        chalk.level = 1;
        try {
            return action();
        } finally {
            chalk.enabled = enabled;
            chalk.level = level;
        }
    };

    it("should print the default report to stderr", () => {
        const stdout = sandbox.stub(console, "log");
        const stderr = sandbox.stub(console, "error");

        printProfilerResult(makeResult());

        assert.notCalled(stdout);
        assert.calledOnce(stderr);
        assert.match(stderr.firstCall.args[0], /^\[profiler] Test run profile/);
    });

    it("should print one aligned report with phase and slow-test tables", () => {
        const durationMs = 246_000;
        const session = finding("session-concurrency-v1", "high", 183_000, "chrome", 194);
        session.observation = "`chrome`: 183.0s; `firefox`: 132.0s. `chrome` finished 50.7s later.";
        session.evidence.push({ metric: "browser", value: "chrome" });
        session.evidence.push({ metric: "browserEnd", value: 183_000, unit: "ms" });
        session.evidence.push({ metric: "nextBrowser", value: "firefox" });
        session.evidence.push({ metric: "nextBrowserEnd", value: 132_000, unit: "ms" });
        session.evidence.push({ metric: "browserTail", value: 50_700, unit: "ms" });
        session.action = "Try sessionsPerBrowser: 12 for chrome (currently 8), unless the external grid is saturated.";

        const result = makeResult({
            durationMs,
            timeline: phaseTimeline(
                [
                    { name: "Execute tests", wallMs: 245_000 },
                    { name: "Read tests", wallMs: 835 },
                    { name: "Load configuration", wallMs: 174 },
                ],
                durationMs,
            ),
            findings: [
                session,
                finding("slow-test-v1", "medium", 24_400, "User registration and first purchase", 2),
                finding("slow-test-v1", "medium", 21_600, "Complete purchase flow", 2),
            ],
        });

        const report = withoutColors(render(result));

        assert.include(report, "[profiler] Test run profile");
        assert.include(report, "Total time: 4m 06s");
        assert.match(report, /Phase\s+Time\s+Time %\s+Bar/);
        assert.match(report, /Execute tests\s+4m 05s\s+99\.6%\s+█{13}/);
        assert.match(report, /Read tests\s+835ms\s+0\.3%/);
        assert.include(report, "1. HIGH • Session capacity • chrome");
        assert.match(report, /chrome: 3m 03s; firefox: 2m 12s\. chrome finished 50\.7s\s+later\./);
        assert.include(report, "2. MEDIUM • Slow tests");
        assert.match(report, /Duration\s+Calls\s+Test/);
        assert.match(report, /24\.4s\s+2\s+User registration and first purchase/);
        assert.match(report, /21\.6s\s+2\s+Complete purchase flow/);
        assert.equal(report.match(/Suggested action:/g)?.length, 2);
        assert.include(report, "[profiler] 2 findings: 1 high, 1 medium");
    });

    it("should explain slow discovery with a component table and file-load context", () => {
        const discovery = finding("test-discovery-v1", "high", 9_000, "Discover and load test files");
        discovery.observation =
            "`Discover and load test files` took 9.0s (90.0% of the run). This operation does not execute tests.";
        discovery.evidence = [
            { metric: "wall", value: 9_000, unit: "ms" },
            { metric: "discoveryGlobWall", value: 6_000, unit: "ms" },
            { metric: "fileLoadWall", value: 2_500, unit: "ms" },
            { metric: "testParseWall", value: 500, unit: "ms" },
            { metric: "otherDiscoveryWall", value: 0, unit: "ms" },
            { metric: "fileCount", value: 1_000 },
            { metric: "averageFileLoad", value: 2, unit: "ms" },
            { metric: "hasFileLoadOutliers", value: false },
        ];
        discovery.action = "Narrow files/sets masks.";

        const report = withoutColors(render(makeResult({ findings: [discovery], durationMs: 10_000 })));

        assert.include(report, "1. HIGH • Slow test discovery • Discover and load test files");
        assert.match(report, /Breakdown\s+Component\s+Time\s+Phase %/);
        assert.match(report, /Find test files \(glob\)\s+6s\s+66\.7%/);
        assert.match(report, /Load test files\s+2\.5s\s+27\.8%/);
        assert.match(report, /Group, parse and validate\s+500ms\s+5\.6%/);
        assert.include(report, "1000 files, avg 2ms each");
        assert.include(report, "Files at least 3× slower than average: none.");

        discovery.evidence.find(item => item.metric === "hasFileLoadOutliers")!.value = true;
        discovery.evidence.push(
            { metric: "fileLoadOutlier", value: "test/slow.testplane.ts", operationId: "slow-file" },
            { metric: "fileLoadOutlierWall", value: 30, unit: "ms", operationId: "slow-file" },
        );
        const reportWithOutlier = withoutColors(render(makeResult({ findings: [discovery], durationMs: 10_000 })));
        assert.match(reportWithOutlier, /Files at least 3× slower than average:\s+• test\/slow\.testplane\.ts — 30ms/);
    });

    it("should label a long-run finding", () => {
        const longRun = finding("long-run-v1", "high", 21 * 60 * 1000, "full run");
        longRun.observation = "The full test run took 1260.0s, longer than the 20-minute threshold.";
        longRun.entityIds = [];

        const report = withoutColors(render(makeResult({ findings: [longRun], durationMs: 21 * 60 * 1000 })));

        assert.include(report, "1. HIGH • Long test run");
        assert.include(report, "The full test run took 21m");
    });

    it("should color durations and confidence according to the example", () => {
        withColors(() => {
            const durationMs = 246_000;
            const report = render(
                makeResult({
                    durationMs,
                    timeline: phaseTimeline(
                        [
                            { name: "Execute tests", wallMs: 245_000 },
                            { name: "Read tests", wallMs: 835 },
                        ],
                        durationMs,
                    ),
                    findings: [finding("slow-test-v1", "medium", 24_400, "Checkout", 2)],
                }),
            );

            assert.include(report, chalk.yellow("[profiler]"));
            assert.include(report, chalk.red("4m 06s"));
            assert.include(report, chalk.red("4m 05s"));
            assert.include(report, chalk.gray("835ms"));
            assert.include(report, chalk.yellow("MEDIUM"));
            assert.include(report, chalk.yellow("24.4s"));
            assert.include(report, chalk.yellow("1 medium"));
            assert.notInclude(report, chalk.cyan("Checkout"));
        });
    });

    it("should show each lifecycle phase once and ignore worker bootstrap copies", () => {
        const timeline = phaseTimeline(
            [
                { name: "Load plugins", wallMs: 150 },
                { name: "Load plugins", wallMs: 440, type: "worker" },
                { name: "Load plugins", wallMs: 430, type: "worker" },
            ],
            100_000,
        );
        const report = withoutColors(render(makeResult({ timeline })));

        assert.lengthOf(report.match(/Load plugins/g)!, 1);
        assert.notInclude(report, "440ms");
    });

    it("should order finding sections by confidence and then impact", () => {
        const report = withoutColors(
            render(
                makeResult({
                    findings: [
                        finding("slow-test-v1", "medium", 34_000, "big medium"),
                        finding("test-file-v1", "high", 300, "small high"),
                        finding("slow-test-v1", "medium", 7_000, "small medium"),
                        finding("session-concurrency-v1", "high", 20_000, "big high"),
                    ],
                }),
            ),
        );

        assert.isBelow(report.indexOf("Session capacity"), report.indexOf("Slow test file load"));
        assert.isBelow(report.indexOf("Slow test file load"), report.indexOf("Slow tests"));
        assert.isBelow(report.indexOf("big medium"), report.indexOf("small medium"));
    });

    it("should rank findings by actionable time impact rather than gate metrics", () => {
        const session = finding("session-concurrency-v1", "medium", 100_000, "chrome");
        session.evidence = [
            { metric: "browser", value: "chrome" },
            { metric: "browserEnd", value: 100_000, unit: "ms" },
            { metric: "browserTail", value: 10_000, unit: "ms" },
            { metric: "sessionLimitSaturationShare", value: 0.9, unit: "ratio" },
        ];
        const report = withoutColors(
            render(
                makeResult({
                    findings: [session, finding("slow-test-v1", "medium", 40_000, "checkout")],
                }),
            ),
        );

        assert.isBelow(report.indexOf("Slow tests"), report.indexOf("Session capacity"));
    });

    it("should group slow findings in a table and print a shared action once", () => {
        const first = finding("slow-test-v1", "medium", 34_000, 'checkout "as guest"');
        const second = finding("slow-test-v1", "medium", 7_000, "search");
        const report = withoutColors(render(makeResult({ findings: [first, second] })));

        assert.include(report, "1. MEDIUM • Slow tests");
        assert.match(report, /34s\s+1\s+checkout "as guest"/);
        assert.match(report, /7s\s+1\s+search/);
        assert.lengthOf(report.match(/Suggested action:/g)!, 1);
        assert.lengthOf(report.match(/Inspect it\./g)!, 1);
    });

    it("should print a slow-command table even when only one command is retained", () => {
        const command = finding("browser-command-v1", "medium", 12_000, "waitUntil", 3);
        command.action = "Inspect the slowest retained calls.";
        command.evidence.push({ metric: "source", value: "test/helpers/commands.ts:42" });
        const report = withoutColors(render(makeResult({ findings: [command] })));

        assert.include(report, "1. MEDIUM • Slow commands");
        assert.match(report, /Duration\s+Calls\s+Command/);
        assert.match(report, /12s\s+3\s+waitUntil/);
        assert.include(report, "Registration sources");
        assert.include(report, "waitUntil — test/helpers/commands.ts:42");
        assert.include(report, "Inspect the slowest retained calls.");
    });

    it("should group slow hooks in a table", () => {
        const report = withoutColors(
            render(
                makeResult({
                    findings: [
                        finding("common-hook-v1", "medium", 34_000, 'suite "before each" hook: prepare', 12),
                        finding("common-hook-v1", "medium", 21_000, 'suite "after each" hook: cleanup', 10),
                    ],
                }),
            ),
        );

        assert.include(report, "1. MEDIUM • Slow hooks");
        assert.match(report, /Duration\s+Calls\s+Hook/);
        assert.match(report, /34s\s+12\s+suite "before each" hook: prepare/);
        assert.match(report, /21s\s+10\s+suite "after each" hook: cleanup/);
        assert.lengthOf(report.match(/Suggested action:/g)!, 1);
        assert.lengthOf(report.match(/Inspect it\./g)!, 1);
    });

    it("should show active JS and waiting as bars for a slow event listener", () => {
        const listener = finding("event-listener-v1", "high", 4_000, "INIT:startServer", 1);
        listener.observation = "`INIT:startServer` used 4.0s across 1 call(s). Slowest retained call took 4.0s.";
        listener.evidence.push(
            { metric: "activeJs", value: 0, unit: "ms" },
            { metric: "waiting", value: 4_000, unit: "ms" },
        );
        listener.action = "Waiting dominates; inspect awaited I/O or timers.";

        const report = withoutColors(render(makeResult({ findings: [listener] })));

        assert.include(report, "Slowest call breakdown");
        assert.match(report, /Activity\s+Time\s+Call %\s+Bar/);
        assert.match(report, /Active JS\s+0ms\s+0\.0%/);
        assert.match(report, /Waiting\s+4s\s+100\.0%\s+█{13}/);
        assert.include(report, "Waiting dominates; inspect awaited I/O or timers.");
    });

    it("should use a plural action heading for multiple event listeners", () => {
        const first = finding("event-listener-v1", "high", 4_000, "INIT:first", 1);
        const second = finding("event-listener-v1", "high", 3_000, "INIT:second", 1);
        first.action = "`INIT:first` (foo/index.js:6:15): optimize synchronous work.";
        second.action = "`INIT:second` (bar/index.js:8:20): inspect awaited I/O.";

        const report = withoutColors(render(makeResult({ findings: [first, second] })));

        assert.include(report, "Suggested actions:");
        assert.notInclude(report, "Suggested action:");
        assert.include(report, "INIT:first (foo/index.js:6:15): optimize synchronous work.");
        assert.include(report, "INIT:second (bar/index.js:8:20): inspect awaited I/O.");
    });

    it("should preserve mixed confidence levels in a grouped heading", () => {
        const report = withoutColors(
            render(
                makeResult({
                    findings: [
                        finding("test-file-v1", "medium", 7_000, "estimated.ts"),
                        finding("test-file-v1", "high", 34_000, "exact.ts"),
                    ],
                }),
            ),
        );

        assert.include(report, "1. HIGH/MEDIUM • Slow test file loads");
    });

    it("should print an explicit empty state in the same report shape", () => {
        const report = withoutColors(render(makeResult()));

        assert.include(report, "Execution breakdown");
        assert.include(report, "No lifecycle phases were retained.");
        assert.include(report, "Performance findings");
        assert.include(report, "No significant bottlenecks were found by the current heuristics.");
        assert.match(report, /\[profiler] No performance findings$/);
    });

    it("should wrap long table values without losing column alignment", () => {
        const longName =
            "Checkout flow with a deliberately long descriptive title that must wrap before it reaches the terminal edge";
        const report = withoutColors(
            render(makeResult({ findings: [finding("slow-test-v1", "medium", 12_000, longName)] })),
        );
        const rows = report.split("\n");
        const firstLine = rows.findIndex(line => line.includes("Checkout flow with a deliberately long"));

        assert.isAtLeast(firstLine, 0);
        assert.equal(rows[firstLine + 1].search(/\S/), rows[firstLine].indexOf("Checkout"));
        assert.isTrue(rows.every(line => line.length <= 88));
        assert.isTrue(rows.every(line => !line.endsWith(" ")));
    });
});
