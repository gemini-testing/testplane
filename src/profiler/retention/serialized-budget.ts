import type { Finding, RetainedOperation, TruncationEntry } from "../schema";
import { RETENTION_POLICY_V1 } from "./policy-v1";

export const enforceSerializedTimelineBudget = (
    level: 1 | 2 | 3,
    timeline: RetainedOperation[],
    findings: Finding[],
): { timeline: RetainedOperation[]; truncation?: TruncationEntry } => {
    const budget = Math.floor(RETENTION_POLICY_V1.serializedResultBudgetBytes[level] * 0.8);
    if (Buffer.byteLength(JSON.stringify(timeline)) <= budget) {
        return { timeline };
    }

    const byId = new Map(timeline.map(operation => [operation.id, operation]));
    const retained = new Map<string, RetainedOperation>();
    const addWithAncestors = (operation: RetainedOperation): void => {
        let current: RetainedOperation | undefined = operation;
        while (current && !retained.has(current.id)) {
            retained.set(current.id, current);
            current = current.parentId ? byId.get(current.parentId) : undefined;
        }
    };

    timeline
        .filter(operation => operation.kind === "testplane.operation" || operation.kind.startsWith("testplane.phase."))
        .forEach(addWithAncestors);
    const findingIds = new Set(findings.flatMap(finding => finding.operationIds));
    timeline.filter(operation => findingIds.has(operation.id)).forEach(addWithAncestors);

    let used = [...retained.values()].reduce((total, operation) => total + serializedSize(operation), 2);
    const candidates = timeline
        .filter(operation => !retained.has(operation.id))
        .sort((left, right) => right.timing.wallMs - left.timing.wallMs);
    for (const operation of candidates) {
        const ancestors: RetainedOperation[] = [];
        let current: RetainedOperation | undefined = operation;
        while (current && !retained.has(current.id)) {
            ancestors.push(current);
            current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        const size = ancestors.reduce((total, item) => total + serializedSize(item), 0);
        if (used + size > budget) {
            continue;
        }
        ancestors.reverse().forEach(item => retained.set(item.id, item));
        used += size;
    }

    const result = [...retained.values()].sort(
        (left, right) => left.startOffsetMs - right.startOffsetMs || left.id.localeCompare(right.id),
    );
    return {
        timeline: result,
        truncation: {
            collector: "serialized-detail-budget",
            seen: timeline.length,
            retained: result.length,
            rule: `retain phases, finding evidence and top wall-time details within ${budget} bytes`,
            truncated: result.length < timeline.length,
        },
    };
};

function serializedSize(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value)) + 1;
}
