import type { RetainedOperation, TruncationEntry } from "../schema";
import { getRetentionBucket, RETENTION_POLICY_V1, RetentionBucket } from "./policy-v1";
import { TopK } from "./top-k";

interface BucketState {
    seen: number;
    values: TopK<RetainedOperation>;
}

/**
 * Keeps bucket winners and only the ancestors needed by those winners.
 * Descendants must be added before their ancestors, matching span completion order.
 */
export class OperationStore {
    private readonly _buckets = new Map<RetentionBucket, BucketState>();
    private readonly _retained = new Map<string, RetainedOperation>();
    private readonly _winnerIds = new Set<string>();
    private readonly _pinnedIds = new Set<string>();
    private readonly _requiredByChildren = new Map<string, number>();

    add(operation: RetainedOperation): void {
        if (operation.kind.startsWith("testplane.phase.") || operation.kind === "testplane.operation") {
            this._pinnedIds.add(operation.id);
            this._retain(operation);
            return;
        }

        const bucket = getRetentionBucket(operation.kind);
        let state = this._buckets.get(bucket);
        if (!state) {
            state = {
                seen: 0,
                values: new TopK(RETENTION_POLICY_V1.operationLimits[bucket]),
            };
            this._buckets.set(bucket, state);
        }

        state.seen += 1;
        const { accepted, evicted } = state.values.add(operation, operation.timing.wallMs);

        if (accepted) {
            this._winnerIds.add(operation.id);
            this._retain(operation);
        } else if (this._isRequired(operation.id)) {
            this._retain(operation);
        }

        if (evicted) {
            this._winnerIds.delete(evicted.id);
            this._releaseIfUnused(evicted.id);
        }
    }

    snapshot(): { operations: RetainedOperation[]; truncation: TruncationEntry[] } {
        const truncation: TruncationEntry[] = [];
        for (const [bucket, state] of this._buckets) {
            let retained = 0;
            for (const operation of this._retained.values()) {
                if (
                    !operation.kind.startsWith("testplane.phase.") &&
                    operation.kind !== "testplane.operation" &&
                    getRetentionBucket(operation.kind) === bucket
                ) {
                    retained += 1;
                }
            }
            truncation.push({
                collector: bucket,
                seen: state.seen,
                retained,
                rule: `top ${RETENTION_POLICY_V1.operationLimits[bucket]} by wall time; keep ancestors of retained operations`,
                truncated: retained < state.seen,
            });
        }

        const operations = [...this._retained.values()].sort(
            (left, right) => left.startOffsetMs - right.startOffsetMs || left.id.localeCompare(right.id),
        );
        return { operations, truncation };
    }

    private _retain(operation: RetainedOperation): void {
        if (this._retained.has(operation.id)) {
            return;
        }

        this._retained.set(operation.id, operation);
        this._incrementRequirement(operation.parentId);
    }

    private _releaseIfUnused(operationId: string): void {
        if (this._winnerIds.has(operationId) || this._pinnedIds.has(operationId) || this._isRequired(operationId)) {
            return;
        }

        const operation = this._retained.get(operationId);
        if (!operation) {
            return;
        }

        this._retained.delete(operationId);
        this._decrementRequirement(operation.parentId);
    }

    private _incrementRequirement(operationId: string | undefined): void {
        if (!operationId) {
            return;
        }

        this._requiredByChildren.set(operationId, (this._requiredByChildren.get(operationId) ?? 0) + 1);
    }

    private _decrementRequirement(operationId: string | undefined): void {
        if (!operationId) {
            return;
        }

        const next = (this._requiredByChildren.get(operationId) ?? 0) - 1;
        if (next > 0) {
            this._requiredByChildren.set(operationId, next);
            return;
        }

        this._requiredByChildren.delete(operationId);
        this._releaseIfUnused(operationId);
    }

    private _isRequired(operationId: string): boolean {
        return (this._requiredByChildren.get(operationId) ?? 0) > 0;
    }
}
