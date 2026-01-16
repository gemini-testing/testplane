import strftime from "strftime";
import { MasterEvents } from "../events";
import type { Test, TestResult, TestAssignedToWorkerData } from "../types";

export interface TrackedTestInfo {
    fullTitle: string;
    browserId: string;
    file: string;
    sessionId?: string;
    workerPid?: number;
    isRunning: boolean;
    startTime: number;
    retry: number;
}

type TestEventsEmitter = {
    on(event: typeof MasterEvents.TEST_BEGIN, handler: (test: Test) => void): unknown;
    on(event: typeof MasterEvents.TEST_ASSIGNED_TO_WORKER, handler: (data: TestAssignedToWorkerData) => void): unknown;
    on(event: typeof MasterEvents.TEST_END, handler: (test: TestResult) => void): unknown;
};

function getTestKey(fullTitle: string, browserId: string): string {
    return `${fullTitle}:${browserId}`;
}

export class TestsTracker {
    private _tests: Map<string, TrackedTestInfo[]> = new Map();

    constructor(emitter: TestEventsEmitter) {
        emitter.on(MasterEvents.TEST_BEGIN, (test: Test) => {
            try {
                const key = getTestKey(test.fullTitle(), test.browserId);
                const sessionId = (test as Test & { sessionId?: string }).sessionId;

                const testInfo: TrackedTestInfo = {
                    fullTitle: test.fullTitle(),
                    browserId: test.browserId,
                    file: test.file || "",
                    sessionId,
                    isRunning: true,
                    startTime: Date.now(),
                    retry: 0,
                };

                if (!this._tests.has(key)) {
                    this._tests.set(key, []);
                }

                this._tests.get(key)!.push(testInfo);
            } catch (err) {
                /** */
            }
        });

        emitter.on(MasterEvents.TEST_ASSIGNED_TO_WORKER, (data: TestAssignedToWorkerData) => {
            try {
                const key = getTestKey(data.fullTitle, data.browserId);
                const testInfos = this._tests.get(key);

                if (testInfos && testInfos.length > 0) {
                    const lastTest = testInfos[testInfos.length - 1];
                    lastTest.workerPid = data.workerPid;
                    lastTest.sessionId = data.sessionId;
                }
            } catch (err) {
                /** */
            }
        });

        emitter.on(MasterEvents.TEST_END, (test: TestResult) => {
            try {
                const key = getTestKey(test.fullTitle(), test.browserId);
                const testInfos = this._tests.get(key);

                if (testInfos && testInfos.length > 0) {
                    const lastTest = testInfos[testInfos.length - 1];
                    lastTest.isRunning = false;

                    const sessionId = (test as TestResult & { sessionId?: string }).sessionId;
                    if (sessionId) {
                        lastTest.sessionId = sessionId;
                    }
                }
            } catch (err) {
                /** */
            }
        });
    }

    getAllTests(): TrackedTestInfo[] {
        try {
            const allTests: TrackedTestInfo[] = [];

            for (const testInfos of this._tests.values()) {
                testInfos.forEach((testInfo, index) => {
                    allTests.push({
                        ...testInfo,
                        retry: index,
                    });
                });
            }

            return allTests;
        } catch (err) {
            return [];
        }
    }
}

export function getTestsByWorkerPid(tests: TrackedTestInfo[], workerPid: number): TrackedTestInfo[] {
    try {
        return tests.filter(t => t.workerPid === workerPid).sort((a, b) => b.startTime - a.startTime);
    } catch (err) {
        return [];
    }
}

export function formatTrackedTests(tests: TrackedTestInfo[]): string {
    try {
        if (tests.length === 0) {
            return "No tests were tracked at the time of the error.";
        }

        const lines = [`These tests were running or recently ran:`];

        for (const { fullTitle, browserId, startTime, workerPid, sessionId, isRunning, file, retry } of tests) {
            const startedAt = strftime("started at %H:%M:%S", new Date(startTime));
            const duration = Date.now() - startTime;
            const status = isRunning ? "RUNNING" : "finished";
            const workerInfo = workerPid ? `worker PID: ${workerPid}` : "worker PID: unknown";
            const sessionInfo = sessionId ? `session: ${sessionId}` : "";
            const retryInfo = `retry: ${Number(retry)}`;
            const extraInfo = [status, workerInfo, sessionInfo, retryInfo].filter(Boolean).join(", ");
            lines.push(`  - "${fullTitle}" [${browserId}] (${startedAt}, took ${duration}ms, ${extraInfo})`);
            lines.push(`    File: ${file || "unknown"}`);
        }

        return lines.join("\n");
    } catch (err) {
        return "Failed to format tracked tests information.";
    }
}
