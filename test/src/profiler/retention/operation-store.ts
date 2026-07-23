import { OperationStore } from "src/profiler/retention/operation-store";
import { RETENTION_POLICY_V1 } from "src/profiler/retention/policy-v1";
import type { RetainedOperation } from "src/profiler/schema";

describe("profiler/retention/operation-store", () => {
    const operation = (id: string, kind: string, wallMs: number, parentId?: string): RetainedOperation => ({
        id,
        parentId,
        kind,
        name: id,
        process: { type: "master", pid: 1 },
        context: { runId: "run" },
        startOffsetMs: 0,
        timing: { wallMs },
        attributes: {},
        quality: { timing: "exact", cpu: "unavailable" },
        status: "completed",
    });

    it("should keep ancestors of retained children even when the parent loses its bucket top-k", () => {
        const store = new OperationStore();
        const attemptLimit = RETENTION_POLICY_V1.operationLimits["test.attempt"];

        // Runtime spans close child-first, so the requirement is known when its parent arrives.
        store.add(operation("acquire", "browser.session.acquire", 10_000, "attempt-0"));
        for (let index = 0; index < attemptLimit + 5; index += 1) {
            store.add(operation(`attempt-${index}`, "test.attempt", index + 1));
        }

        const { operations, truncation } = store.snapshot();
        const byId = new Map(operations.map(item => [item.id, item]));

        assert.isTrue(byId.has("acquire"));
        assert.isTrue(byId.has("attempt-0"));
        assert.equal(byId.get("acquire")!.parentId, "attempt-0");

        const attemptTruncation = truncation.find(item => item.collector === "test.attempt");
        assert.isTrue(attemptTruncation!.truncated);
        assert.equal(attemptTruncation!.retained, attemptLimit + 1); // top-k winners + pinned ancestor
        assert.match(attemptTruncation!.rule, /keep ancestors/);
    });

    it("should still drop operations that are neither top-k winners nor ancestors of winners", () => {
        const store = new OperationStore();
        const attemptLimit = RETENTION_POLICY_V1.operationLimits["test.attempt"];

        store.add(operation("acquire", "browser.session.acquire", 10_000, "attempt-0"));
        for (let index = 0; index < attemptLimit + 5; index += 1) {
            store.add(operation(`attempt-${index}`, "test.attempt", index + 1));
        }

        const { operations } = store.snapshot();
        const attemptIds = operations.filter(item => item.kind === "test.attempt").map(item => item.id);

        assert.include(attemptIds, "attempt-0"); // pinned ancestor of retained child
        assert.notInclude(attemptIds, "attempt-1"); // cold, not an ancestor of any retained child
        assert.lengthOf(attemptIds, attemptLimit + 1);
    });

    it("should bound live storage by current winners and their ancestors", () => {
        const store = new OperationStore();
        const attemptLimit = RETENTION_POLICY_V1.operationLimits["test.attempt"];

        for (let index = 0; index < attemptLimit * 100; index += 1) {
            store.add(operation(`attempt-${index}`, "test.attempt", index + 1));
        }

        assert.lengthOf(store.snapshot().operations, attemptLimit);
        const internals = store as unknown as {
            _retained: Map<string, RetainedOperation>;
            _winnerIds: Set<string>;
            _requiredByChildren: Map<string, number>;
        };
        assert.isAtMost(internals._retained.size, attemptLimit);
        assert.isAtMost(internals._winnerIds.size, attemptLimit);
        assert.isEmpty(internals._requiredByChildren);
    });

    it("should release an ancestor after its last retained child and own top-k entry are evicted", () => {
        const store = new OperationStore();
        const listenerLimit = RETENTION_POLICY_V1.operationLimits["event.listener"];
        const attemptLimit = RETENTION_POLICY_V1.operationLimits["test.attempt"];

        store.add(operation("listener-0", "event.listener", 1, "attempt-0"));
        store.add(operation("attempt-0", "test.attempt", 1));
        for (let index = 1; index <= listenerLimit; index += 1) {
            store.add(operation(`listener-${index}`, "event.listener", index + 1));
        }
        for (let index = 1; index <= attemptLimit; index += 1) {
            store.add(operation(`attempt-${index}`, "test.attempt", index + 1));
        }

        const ids = store.snapshot().operations.map(item => item.id);
        assert.notInclude(ids, "listener-0");
        assert.notInclude(ids, "attempt-0");
        assert.isEmpty((store as unknown as { _requiredByChildren: Map<string, number> })._requiredByChildren);
    });
});
