import chalk from "chalk";
import { compareFindings } from "../analysis/finding-order";
import type { Finding, ProfilerConfidence, ProfilerResultV1, RetainedOperation } from "../schema";

export interface ProfilerConsole {
    log(message: string): void;
    warn(message: string): void;
}

const defaultConsole: ProfilerConsole = {
    log: message => console.log(message),
    warn: message => console.warn(message),
};

const FINDING_LABELS: Record<string, string> = {
    "long-run-v1": "Long test run",
    "major-phase-v1": "Slow phase",
    "unattributed-v1": "Unattributed time",
    "event-listener-v1": "Slow event listener",
    "test-file-v1": "Slow test file load",
    "slow-test-v1": "Slow test",
    "common-hook-v1": "Slow hook",
    "browser-command-v1": "Slow command",
    "browser-pause-v1": "Excessive pause",
    "module-dependency-v1": "Slow dependency",
    "worker-capacity-v1": "Worker capacity",
    "session-concurrency-v1": "Session capacity",
    "test-discovery-v1": "Slow test discovery",
    "host-cpu-v1": "High host CPU",
    "event-loop-delay-v1": "Event-loop delay",
};

const FINDING_GROUP_LABELS: Record<string, string> = {
    "major-phase-v1": "Slow phases",
    "event-listener-v1": "Slow event listeners",
    "test-file-v1": "Slow test file loads",
    "slow-test-v1": "Slow tests",
    "common-hook-v1": "Slow hooks",
    "browser-command-v1": "Slow commands",
    "browser-pause-v1": "Excessive pauses",
    "module-dependency-v1": "Slow dependencies",
};

const TABLE_FINDINGS = new Map([
    ["slow-test-v1", "Test"],
    ["common-hook-v1", "Hook"],
    ["browser-command-v1", "Command"],
]);
const CONFIDENCE_RANK: Record<ProfilerConfidence, number> = { high: 3, medium: 2, low: 1 };
const REPORT_WIDTH = 88;
const BAR_WIDTH = 13;
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

interface FindingGroup {
    analyzerId: string;
    findings: Finding[];
}

interface TableColumn {
    header: string;
    align?: "left" | "right";
}

export const printProfilerResult = (
    result: Readonly<ProfilerResultV1>,
    output: ProfilerConsole = defaultConsole,
): void => {
    output.log(renderReport(result));
};

function renderReport(result: Readonly<ProfilerResultV1>): string {
    const groups = groupFindings(sortFindings(result.findings));
    const lines = [
        `${profilerPrefix()} Test run profile`,
        divider(),
        "",
        `Total time: ${chalk.red(formatDuration(result.run.durationMs))}`,
        "",
        "Execution breakdown",
        ...renderExecutionBreakdown(result),
        "",
        "Performance findings",
        "",
    ];

    if (!groups.length) {
        lines.push("No significant bottlenecks were found by the current heuristics.", "", divider());
        lines.push(`${profilerPrefix()} No performance findings`);
        return lines.join("\n");
    }

    groups.forEach((group, index) => {
        lines.push(...renderFindingGroup(group, index + 1));
        lines.push("");
    });

    lines.push(divider());
    lines.push(`${profilerPrefix()} ${formatFindingSummary(groups)}`);
    return lines.join("\n");
}

function renderExecutionBreakdown(result: Readonly<ProfilerResultV1>): string[] {
    const phases = topLevelPhases(result.timeline)
        .sort((left, right) => right.timing.wallMs - left.timing.wallMs)
        .slice(0, 6);
    if (!phases.length) {
        return ["", "    No lifecycle phases were retained."];
    }

    const rows = phases.map(phase => {
        const ratio = result.run.durationMs > 0 ? phase.timing.wallMs / result.run.durationMs : 0;
        const duration = formatDuration(phase.timing.wallMs);
        return [
            phase.name,
            ratio >= 0.5 ? chalk.red(duration) : chalk.gray(duration),
            formatPercent(ratio),
            formatBar(ratio),
        ];
    });

    return [
        "",
        ...renderTable(
            [
                { header: "Phase" },
                { header: "Time", align: "right" },
                { header: "Time %", align: "right" },
                { header: "Bar" },
            ],
            rows,
        ),
    ];
}

function renderFindingGroup(group: FindingGroup, position: number): string[] {
    const label =
        group.findings.length > 1 || TABLE_FINDINGS.has(group.analyzerId)
            ? FINDING_GROUP_LABELS[group.analyzerId] ?? FINDING_LABELS[group.analyzerId] ?? "Performance notes"
            : FINDING_LABELS[group.analyzerId] ?? "Performance note";
    const entity =
        group.findings.length === 1 && !TABLE_FINDINGS.has(group.analyzerId)
            ? findingEntity(group.findings[0])
            : undefined;
    const title = [`${position}.`, formatGroupConfidence(group.findings), "•", label];
    if (entity) {
        title.push("•", entity);
    }

    const lines = [title.join(" "), ""];
    if (TABLE_FINDINGS.has(group.analyzerId)) {
        lines.push(...renderSlowFindingTable(group.findings, TABLE_FINDINGS.get(group.analyzerId)!));
        if (group.analyzerId === "browser-command-v1") {
            lines.push(...renderCommandSources(group.findings));
        }
    } else if (group.analyzerId === "event-listener-v1") {
        lines.push(...renderEventListenerFindings(group.findings));
    } else if (group.analyzerId === "test-discovery-v1" && group.findings.length === 1) {
        lines.push(...renderTestDiscoveryFinding(group.findings[0]));
    } else if (group.findings.length === 1) {
        lines.push(...indentWrapped(formatFindingText(group.findings[0].observation, group.findings[0]), 4));
    } else {
        for (const finding of group.findings) {
            lines.push(...indentWrapped(`• ${formatFindingText(finding.observation, finding)}`, 4));
        }
    }

    const actions = [...new Set(group.findings.map(finding => plainFindingText(finding.action)))];
    lines.push("", actions.length === 1 ? "    Suggested action:" : "    Suggested actions:");
    if (actions.length === 1) {
        lines.push(...indentWrapped(actions[0], 4));
    } else {
        for (const action of actions) {
            lines.push(...indentWrapped(`• ${action}`, 4));
        }
    }

    return lines;
}

function renderEventListenerFindings(findings: Finding[]): string[] {
    const lines: string[] = [];

    findings.forEach((finding, index) => {
        const bullet = findings.length > 1 ? "• " : "";
        lines.push(...indentWrapped(`${bullet}${formatFindingText(finding.observation, finding)}`, 4));

        const activeJsMs = numericEvidence(finding, "activeJs");
        const waitingMs = numericEvidence(finding, "waiting");
        if (activeJsMs !== undefined && waitingMs !== undefined) {
            const totalMs = Math.max(1, activeJsMs + waitingMs);
            const breakdown: Array<[string, number]> = [
                ["Active JS", activeJsMs],
                ["Waiting", waitingMs],
            ];
            const rows = breakdown.map(([label, durationMs]) => {
                const ratio = durationMs / totalMs;
                return [
                    label,
                    colorByConfidence(formatDuration(durationMs), finding.confidence),
                    formatPercent(ratio),
                    formatBar(ratio),
                ];
            });
            lines.push(
                "",
                "    Slowest call breakdown",
                ...renderTable(
                    [
                        { header: "Activity" },
                        { header: "Time", align: "right" },
                        { header: "Call %", align: "right" },
                        { header: "Bar" },
                    ],
                    rows,
                ),
            );
        }

        if (index < findings.length - 1) {
            lines.push("");
        }
    });

    return lines;
}

function renderTestDiscoveryFinding(finding: Finding): string[] {
    const lines = [...indentWrapped(formatFindingText(finding.observation, finding), 4)];
    const phaseWallMs = numericEvidence(finding, "wall") ?? 0;
    const components = [
        ["Find test files (glob)", "discoveryGlobWall"],
        ["Load test files", "fileLoadWall"],
        ["Group, parse and validate", "testParseWall"],
        ["Other", "otherDiscoveryWall"],
    ] as const;
    const rows = components
        .map(([label, metric]) => [label, numericEvidence(finding, metric) ?? 0] as const)
        .filter(([, wallMs]) => wallMs > 0)
        .map(([label, wallMs]) => [
            label,
            colorByConfidence(formatDuration(wallMs), finding.confidence),
            formatPercent(phaseWallMs > 0 ? wallMs / phaseWallMs : 0),
        ]);
    if (rows.length) {
        lines.push(
            "",
            "    Breakdown",
            ...renderTable(
                [{ header: "Component" }, { header: "Time", align: "right" }, { header: "Phase %", align: "right" }],
                rows,
            ),
        );
    }

    const fileCount = numericEvidence(finding, "fileCount");
    const averageFileLoadMs = numericEvidence(finding, "averageFileLoad");
    if (fileCount === undefined && averageFileLoadMs === undefined) {
        return lines;
    }

    const summary = [
        fileCount === undefined ? undefined : `${fileCount} files`,
        averageFileLoadMs === undefined ? undefined : `avg ${formatDuration(averageFileLoadMs)} each`,
    ]
        .filter(Boolean)
        .join(", ");
    lines.push("", "    File loads", `    ${summary}`);

    const hasOutliers = finding.evidence.find(item => item.metric === "hasFileLoadOutliers")?.value;
    if (hasOutliers === false) {
        lines.push("    Files at least 3× slower than average: none.");
    } else if (hasOutliers === true) {
        const outliers = finding.evidence.filter(
            item => item.metric === "fileLoadOutlier" && typeof item.value === "string",
        );
        if (!outliers.length) {
            lines.push("    At least one file was 3× slower than average; its detail was not retained.");
        } else {
            lines.push("    Files at least 3× slower than average:");
            for (const outlier of outliers) {
                const wallMs = finding.evidence.find(
                    item => item.metric === "fileLoadOutlierWall" && item.operationId === outlier.operationId,
                )?.value;
                const duration =
                    typeof wallMs === "number"
                        ? ` — ${colorByConfidence(formatDuration(wallMs), finding.confidence)}`
                        : "";
                lines.push(`    • ${outlier.value}${duration}`);
            }
        }
    } else {
        lines.push("    Individual file outliers require profiler.level 2.");
    }

    return lines;
}

function renderSlowFindingTable(findings: Finding[], entityHeader: string): string[] {
    const rows = findings.map(finding => {
        const durationMs = numericEvidence(finding, "totalWall") ?? firstDurationEvidence(finding) ?? 0;
        const calls = numericEvidence(finding, "count") ?? callsFromObservation(finding.observation) ?? 1;
        return [
            colorByConfidence(formatDuration(durationMs), finding.confidence),
            String(calls),
            wrapText(findingEntity(finding) ?? "<unknown>", 55),
        ];
    });

    return renderTable(
        [{ header: "Duration", align: "right" }, { header: "Calls", align: "right" }, { header: entityHeader }],
        rows,
        true,
    );
}

function renderCommandSources(findings: Finding[]): string[] {
    const sources = findings.flatMap(finding => {
        const source = finding.evidence.find(item => item.metric === "source")?.value;
        return typeof source === "string" ? [[findingEntity(finding) ?? "<unknown>", source]] : [];
    });
    if (!sources.length) {
        return [];
    }

    return ["", "    Registration sources", ...sources.map(([command, source]) => `    • ${command} — ${source}`)];
}

function renderTable(columns: TableColumn[], rows: string[][], blankLineBetweenRows = false): string[] {
    const splitRows = rows.map(row => row.map(cell => cell.split("\n")));
    const widths = columns.map((column, index) =>
        Math.max(visibleLength(column.header), ...splitRows.flatMap(row => row[index]?.map(visibleLength) ?? [0])),
    );
    const renderCells = (cells: string[]): string =>
        `    ${cells
            .map((cell, index) =>
                index === cells.length - 1 ? cell : padCell(cell, widths[index], columns[index].align),
            )
            .join("    ")}`.trimEnd();
    const lines = [
        renderCells(columns.map(column => column.header)),
        renderCells(widths.map(width => "_".repeat(width))),
    ];

    splitRows.forEach((row, rowIndex) => {
        const height = Math.max(...row.map(cell => cell.length));
        for (let line = 0; line < height; line++) {
            lines.push(renderCells(row.map(cell => cell[line] ?? "")));
        }
        if (blankLineBetweenRows && rowIndex < splitRows.length - 1) {
            lines.push("");
        }
    });

    return lines;
}

function sortFindings(findings: Finding[]): Finding[] {
    return [...findings].sort(compareFindings);
}

function groupFindings(findings: Finding[]): FindingGroup[] {
    const groups = new Map<string, Finding[]>();
    for (const finding of findings) {
        const group = groups.get(finding.analyzer.id) ?? [];
        group.push(finding);
        groups.set(finding.analyzer.id, group);
    }
    return [...groups].map(([analyzerId, groupedFindings]) => ({ analyzerId, findings: groupedFindings }));
}

function findingEntity(finding: Finding): string | undefined {
    const explicit = finding.entityIds?.find(Boolean);
    if (explicit) {
        return explicit;
    }
    const evidence = finding.evidence.find(
        item => typeof item.value === "string" && ["browser", "process"].includes(item.metric),
    );
    if (typeof evidence?.value === "string") {
        return evidence.value;
    }
    return finding.observation.match(/`([^`]*)`/)?.[1];
}

function formatGroupConfidence(findings: Finding[]): string {
    const values = [...new Set(findings.map(finding => finding.confidence))].sort(
        (left, right) => CONFIDENCE_RANK[right] - CONFIDENCE_RANK[left],
    );
    return values.map(value => colorByConfidence(value.toUpperCase(), value)).join("/");
}

function formatFindingSummary(groups: FindingGroup[]): string {
    const counts = new Map<ProfilerConfidence, number>();
    for (const group of groups) {
        const confidence = [...group.findings].sort(
            (left, right) => CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence],
        )[0].confidence;
        counts.set(confidence, (counts.get(confidence) ?? 0) + 1);
    }
    const details = (["high", "medium", "low"] as const)
        .filter(confidence => counts.has(confidence))
        .map(confidence => {
            const count = counts.get(confidence)!;
            return colorByConfidence(`${count} ${confidence}`, confidence);
        });
    const noun = groups.length === 1 ? "finding" : "findings";
    return `${groups.length} ${noun}: ${details.join(", ")}`;
}

function formatFindingText(text: string, finding: Finding): string {
    let result = plainFindingText(text);
    for (const evidence of finding.evidence) {
        if (evidence.unit !== "ms" || typeof evidence.value !== "number") {
            continue;
        }
        const analyzerDuration =
            evidence.value >= 1000 ? `${(evidence.value / 1000).toFixed(1)}s` : `${evidence.value.toFixed(0)}ms`;
        result = result.replaceAll(
            analyzerDuration,
            colorByConfidence(formatDuration(evidence.value), finding.confidence),
        );
    }
    return result;
}

function plainFindingText(text: string): string {
    return text.replace(/`([^`]*)`/g, "$1");
}

function numericEvidence(finding: Finding, metric: string): number | undefined {
    const value = finding.evidence.find(item => item.metric === metric)?.value;
    return typeof value === "number" ? value : undefined;
}

function firstDurationEvidence(finding: Finding): number | undefined {
    const value = finding.evidence.find(item => item.unit === "ms")?.value;
    return typeof value === "number" ? value : undefined;
}

function callsFromObservation(observation: string): number | undefined {
    const value = observation.match(/\bacross (\d+) call/)?.[1];
    return value === undefined ? undefined : Number(value);
}

function colorByConfidence(value: string, confidence: ProfilerConfidence): string {
    if (confidence === "high") {
        return chalk.red(value);
    }
    if (confidence === "medium") {
        return chalk.yellow(value);
    }
    return chalk.gray(value);
}

function topLevelPhases(timeline: RetainedOperation[]): RetainedOperation[] {
    const root = timeline.find(operation => operation.kind === "testplane.operation");
    if (!root) {
        return [];
    }

    // Workers repeat bootstrap phases in parallel. The breakdown describes the master lifecycle,
    // so retain the largest master occurrence of each direct root phase.
    const byName = new Map<string, RetainedOperation>();
    for (const operation of timeline) {
        if (
            operation.parentId !== root.id ||
            !operation.kind.startsWith("testplane.phase.") ||
            operation.process.type !== "master"
        ) {
            continue;
        }
        const existing = byName.get(operation.name);
        if (!existing || operation.timing.wallMs > existing.timing.wallMs) {
            byName.set(operation.name, operation);
        }
    }
    return [...byName.values()];
}

function formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
        return `${Math.round(milliseconds)}ms`;
    }

    const seconds = Math.round(milliseconds / 100) / 10;
    if (seconds < 60) {
        return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
    }

    const roundedSeconds = Math.round(seconds);
    return `${Math.floor(roundedSeconds / 60)}m ${String(roundedSeconds % 60).padStart(2, "0")}s`;
}

function formatPercent(ratio: number): string {
    const percent = Math.max(0, ratio * 100);
    return percent > 0 && percent < 0.1 ? "<0.1%" : `${percent.toFixed(1)}%`;
}

function formatBar(ratio: number): string {
    const filled = Math.min(BAR_WIDTH, Math.round(Math.max(0, ratio) * BAR_WIDTH));
    return filled ? "█".repeat(filled) : "";
}

function indentWrapped(value: string, indentation: number): string[] {
    const prefix = " ".repeat(indentation);
    return wrapText(value, REPORT_WIDTH - indentation)
        .split("\n")
        .map(line => `${prefix}${line}`);
}

function wrapText(value: string, width: number): string {
    return value
        .split("\n")
        .flatMap(line => {
            const words = line.split(/\s+/).filter(Boolean);
            const wrapped: string[] = [];
            let current = "";
            for (const word of words) {
                if (current && visibleLength(`${current} ${word}`) > width) {
                    wrapped.push(current);
                    current = word;
                } else {
                    current = current ? `${current} ${word}` : word;
                }
            }
            wrapped.push(current);
            return wrapped;
        })
        .join("\n");
}

function padCell(value: string, width: number, align: TableColumn["align"] = "left"): string {
    const padding = " ".repeat(Math.max(0, width - visibleLength(value)));
    return align === "right" ? `${padding}${value}` : `${value}${padding}`;
}

function visibleLength(value: string): number {
    return value.replace(ANSI_PATTERN, "").length;
}

function profilerPrefix(): string {
    return chalk.yellow("[profiler]");
}

function divider(): string {
    return "_".repeat(REPORT_WIDTH);
}
