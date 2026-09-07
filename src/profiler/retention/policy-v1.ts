import type { EnabledProfilerLevel } from "../schema";

export const RETENTION_POLICY_V1 = Object.freeze({
    version: 1,
    operationLimits: {
        "event.listener": 100,
        "test.file": 200,
        "test.attempt": 100,
        "test.body": 200,
        "test.hook": 200,
        "module.load": 200,
        "browser.command": 500,
        other: 1000,
    },
    maxErrors: 50,
    maxAggregateIdentities: 5000,
    serializedResultBudgetBytes: {
        1: 1024 * 1024,
        2: 5 * 1024 * 1024,
        3: 20 * 1024 * 1024,
    } satisfies Record<EnabledProfilerLevel, number>,
});

export type RetentionBucket = keyof typeof RETENTION_POLICY_V1.operationLimits;

export const getRetentionBucket = (kind: string): RetentionBucket => {
    if (kind.startsWith("event.listener")) {
        return "event.listener";
    }
    if (kind.startsWith("test.file") || kind.startsWith("files.load")) {
        return "test.file";
    }
    if (kind === "test.body") {
        return "test.body";
    }
    if (kind.startsWith("test.attempt")) {
        return "test.attempt";
    }
    if (kind.startsWith("test.hook") || kind.includes("beforeEach") || kind.includes("afterEach")) {
        return "test.hook";
    }
    if (kind.startsWith("module.")) {
        return "module.load";
    }
    if (kind.startsWith("browser.command")) {
        return "browser.command";
    }
    return "other";
};
