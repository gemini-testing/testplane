import type { CorrelationContext, Finding, RetainedOperation } from "../schema";

export function compactProfileReferences(
    timeline: RetainedOperation[],
    findings: Finding[],
): { timeline: RetainedOperation[]; findings: Finding[] } {
    const compactIdByOriginalId = new Map<string, string>();
    const root = timeline.find(operation => operation.kind === "testplane.operation");
    const operationsInIdOrder = root ? [root, ...timeline.filter(operation => operation !== root)] : timeline;

    for (const operation of operationsInIdOrder) {
        compactIdByOriginalId.set(operation.id, `op:${compactIdByOriginalId.size.toString(36)}`);
    }

    const getCompactId = (originalId: string): string => {
        const compactId = compactIdByOriginalId.get(originalId);
        if (compactId) {
            return compactId;
        }

        const newCompactId = `op:${compactIdByOriginalId.size.toString(36)}`;
        compactIdByOriginalId.set(originalId, newCompactId);
        return newCompactId;
    };

    return {
        timeline: timeline.map(operation => ({
            ...operation,
            id: getCompactId(operation.id),
            parentId: operation.parentId === undefined ? undefined : getCompactId(operation.parentId),
            context: compactContext(operation.context, getCompactId),
        })),
        findings: findings.map(finding => ({
            ...finding,
            operationIds: finding.operationIds.map(getCompactId),
            evidence: finding.evidence.map(item => ({
                ...item,
                operationId: item.operationId === undefined ? undefined : getCompactId(item.operationId),
            })),
        })),
    };
}

function compactContext(context: CorrelationContext, getCompactId: (id: string) => string): CorrelationContext {
    const result = { ...context };
    delete result.runId;
    if (result.spanId !== undefined) {
        result.spanId = getCompactId(result.spanId);
    }
    return result;
}
