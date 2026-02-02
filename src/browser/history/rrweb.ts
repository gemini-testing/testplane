import fs from "fs";
import { eventWithTime } from "@rrweb/types";
import type { Callstack } from "./callstack";
import { MasterEvents } from "../../events";
import { SnapshotsData, TestContext } from "../../types";
import { runWithoutHistory } from "./index";
import path from "path";

// Built from branch https://github.com/gemini-testing/rrweb/tree/TESTPLANE-712.syntax_err
// PR: https://github.com/rrweb-io/rrweb/pull/1735
// Issue: https://github.com/rrweb-io/rrweb/issues/1734
const rrwebCode = fs.readFileSync(path.join(__dirname, "../client-scripts/rrweb-record.min.js"), "utf-8");

export async function installRrwebAndCollectEvents(
    session: WebdriverIO.Browser,
    callstack: Callstack,
): Promise<eventWithTime[]> {
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    return runWithoutHistory<Promise<eventWithTime[]>>({ callstack }, () =>
        session.execute(
            (rrwebRecordFnCode, serverTime) => {
                const getRealTimestamp = (fallbackTime: number = 0): number => {
                    const nativeCode = "[native code]";

                    try {
                        if (Date.now.toString().includes(nativeCode)) {
                            return Date.now();
                        }
                    } catch (e) {
                        /**/
                    }

                    try {
                        if (new Date().getTime.toString().includes(nativeCode)) {
                            return new Date().getTime();
                        }
                    } catch (e) {
                        /**/
                    }

                    try {
                        if (new Date().valueOf.toString().includes(nativeCode)) {
                            return new Date().valueOf();
                        }
                    } catch (e) {
                        /**/
                    }

                    try {
                        if (performance.now.toString().includes(nativeCode)) {
                            return Math.floor(performance.timeOrigin + performance.now());
                        }
                    } catch (e) {
                        /**/
                    }

                    return fallbackTime;
                };

                try {
                    // @ts-expect-error
                    if (!window.rrweb) {
                        window.eval(rrwebRecordFnCode);
                        // @ts-expect-error
                        window.lastProcessedRrwebEvent = -1;
                        // @ts-expect-error
                        window.rrwebEvents = [];

                        // @ts-expect-error
                        window.rrweb.record({
                            // @ts-expect-error
                            emit(event) {
                                event.timestamp = getRealTimestamp(serverTime);

                                // @ts-expect-error
                                window.rrwebEvents.push(event);
                            },
                        });

                        // @ts-expect-error
                        window.rrweb.record.addCustomEvent("color-scheme-change", {
                            colorScheme:
                                window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
                                    ? "dark"
                                    : "light",
                        });

                        window.matchMedia &&
                            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => {
                                // @ts-expect-error
                                window.rrweb.record.addCustomEvent("color-scheme-change", {
                                    colorScheme: event.matches ? "dark" : "light",
                                });
                            });
                    }
                } catch (e) {
                    /**/
                }

                let result;
                try {
                    // @ts-expect-error
                    result = window.rrwebEvents.slice(window.lastProcessedRrwebEvent + 1);
                    // @ts-expect-error
                    window.lastProcessedRrwebEvent = window.rrwebEvents.length - 1;
                } catch {
                    result = [];
                }

                return result;
            },
            rrwebCode,
            Date.now(),
        ),
    );
    /* eslint-enable @typescript-eslint/ban-ts-comment */
}

export function filterEvents(rrwebEvents: eventWithTime[]): eventWithTime[] {
    return rrwebEvents.filter(e => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dataAny = e?.data as any;
        // cd_frame_id_ attribute is specific for chromedriver and in rare cases can be captured by rrweb
        // It doesn't hold any value, and we want to get rid of it here.
        return !dataAny?.attributes?.[0]?.attributes?.["cd_frame_id_"];
    });
}

export function sendFilteredEvents(session: WebdriverIO.Browser, rrwebEvents: eventWithTime[]): void {
    const currentTest = session.executionContext?.ctx?.currentTest;
    if (rrwebEvents.length > 0 && process.send && currentTest) {
        process.send({
            event: MasterEvents.DOM_SNAPSHOTS,
            context: {
                testPath: currentTest.titlePath(),
                browserId: currentTest.browserId,
            } satisfies TestContext,
            data: {
                rrwebSnapshots: rrwebEvents,
            } satisfies SnapshotsData,
        });
    }
}
