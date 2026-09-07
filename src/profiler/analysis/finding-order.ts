import type { Finding, ProfilerConfidence } from "../schema";

type ComparableFinding = Pick<Finding, "confidence" | "evidence">;

const CONFIDENCE_RANK: Record<ProfilerConfidence, number> = { high: 3, medium: 2, low: 1 };
const TIME_IMPACT_METRICS = [
    "browserTail",
    "observedUnionWall",
    "totalWall",
    "unattributedWall",
    "wall",
    "concurrentWorkerCallOverlap",
    "eventLoopDelayP95",
];

export function compareFindings(left: ComparableFinding, right: ComparableFinding): number {
    return (
        CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence] ||
        findingImpactMs(right) - findingImpactMs(left)
    );
}

function findingImpactMs(finding: ComparableFinding): number {
    for (const metric of TIME_IMPACT_METRICS) {
        const evidence = finding.evidence.find(candidate => candidate.metric === metric);
        if (evidence?.unit === "ms" && typeof evidence.value === "number") {
            return evidence.value;
        }
    }
    return 0;
}
