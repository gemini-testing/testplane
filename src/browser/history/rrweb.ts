import fs from "fs";
import path from "path";
import { eventWithTime } from "@rrweb/types";
import makeDebug from "debug";
import type { Callstack } from "./callstack";
import { MasterEvents } from "../../events";
import type { SnapshotsData, Test, TestContext } from "../../types";
import { runWithoutHistory } from "./index";

const debug = makeDebug("testplane:time-travel:rrweb");

// Built from branch https://github.com/gemini-testing/rrweb/tree/TESTPLANE-712.syntax_err
// PR: https://github.com/rrweb-io/rrweb/pull/1735
// Issue: https://github.com/rrweb-io/rrweb/issues/1734
const rrwebCode = fs.readFileSync(path.join(__dirname, "../client-scripts/rrweb-record.min.js"), "utf-8");
const sessionsWithRrwebSent = new WeakSet<WebdriverIO.Browser>();
const sessionsWithUnsupportedRrweb = new WeakSet<WebdriverIO.Browser>();
const INTERNET_EXPLORER_BROWSER_NAME = "internet explorer";

const isInternetExplorer = (session: WebdriverIO.Browser): boolean =>
    session.capabilities.browserName?.toLowerCase() === INTERNET_EXPLORER_BROWSER_NAME;

interface CollectRrwebEventsResult {
    isRrwebSupported?: false;
    isRrwebInstalled: boolean;
    rrwebEvents: eventWithTime[];
    evalError?: string;
}

/* eslint-disable @typescript-eslint/ban-ts-comment */
export async function installRrwebAndCollectEvents(
    session: WebdriverIO.Browser,
    callstack: Callstack,
): Promise<eventWithTime[]> {
    if (isInternetExplorer(session)) {
        return [];
    }

    return runWithoutHistory<Promise<eventWithTime[]>>({ callstack }, async () => {
        if (sessionsWithUnsupportedRrweb.has(session)) {
            return [];
        }

        const shouldSendRrwebCode = !sessionsWithRrwebSent.has(session);

        if (shouldSendRrwebCode) {
            sessionsWithRrwebSent.add(session);
        }

        let result = await collectRrwebEvents(session, shouldSendRrwebCode ? rrwebCode : undefined);

        let debugBrowserId = "";
        if (debug.enabled) {
            debugBrowserId = `${session?.capabilities?.browserName} ${session?.capabilities?.browserVersion}:${session?.sessionId}`;
        }

        if (result.isRrwebSupported === false) {
            debug("rrweb is not supported in browser %s, error: %s", debugBrowserId, result.evalError);
            sessionsWithUnsupportedRrweb.add(session);

            return [];
        }

        // If rrweb is installed (success) or we already provided the code (no point in trying again)
        if (result.isRrwebInstalled || shouldSendRrwebCode) {
            return result.rrwebEvents;
        }

        debug("collectRrwebEvents, rrweb was not installed, sending code again");

        result = await collectRrwebEvents(session, rrwebCode);

        if (result.isRrwebSupported === false) {
            debug("rrweb is not supported in browser %s, error: %s", debugBrowserId, result.evalError);
            sessionsWithUnsupportedRrweb.add(session);

            return [];
        }

        return result.rrwebEvents;
    });
}

export async function cleanupRrweb(session: WebdriverIO.Browser, callstack: Callstack): Promise<void> {
    if (isInternetExplorer(session)) {
        return;
    }

    try {
        await runWithoutHistory<Promise<void>>({ callstack }, () =>
            session.execute(() => {
                try {
                    // @ts-expect-error
                    const rrwebEvents = window.rrwebEvents;
                    const rrwebData = rrwebEvents && rrwebEvents.testplane;

                    if (rrwebData && rrwebData.stopRecording) {
                        try {
                            rrwebData.stopRecording();
                        } catch (e) {
                            /**/
                        }
                    }

                    try {
                        const colorSchemeMedia = rrwebData && rrwebData.colorSchemeMedia;
                        const colorSchemeListener = rrwebData && rrwebData.colorSchemeListener;

                        if (colorSchemeMedia && colorSchemeListener) {
                            colorSchemeMedia.removeEventListener("change", colorSchemeListener);
                        }
                    } catch (e) {
                        /**/
                    }

                    if (rrwebData && rrwebData.isInstalledByTestplane) {
                        // @ts-expect-error
                        delete window.rrweb;

                        // @ts-expect-error
                        delete window.lastProcessedRrwebEvent;
                        // @ts-expect-error
                        delete window.rrwebEvents;
                    } else if (rrwebEvents) {
                        delete rrwebEvents.testplane;
                    }
                } catch (e) {
                    /**/
                }
            }),
        );
    } catch (e) {
        /**/
    } finally {
        sessionsWithRrwebSent.delete(session);
        sessionsWithUnsupportedRrweb.delete(session);
    }
}

function collectRrwebEvents(
    session: WebdriverIO.Browser,
    rrwebRecordFnCode: string | undefined,
): Promise<CollectRrwebEventsResult> {
    return session.execute(
        (rrwebRecordFnCode, serverTime) => {
            const isRrwebInstalled = (): boolean => {
                try {
                    // @ts-expect-error
                    return Boolean(window.rrweb);
                } catch (e) {
                    return false;
                }
            };

            const getRrwebEvents = (): eventWithTime[] => {
                let result: eventWithTime[];
                try {
                    // @ts-expect-error
                    result = window.rrwebEvents.slice(window.lastProcessedRrwebEvent + 1);
                    // @ts-expect-error
                    window.lastProcessedRrwebEvent = window.rrwebEvents.length - 1;
                } catch (e) {
                    result = [];
                }

                return result;
            };

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
                if (!isRrwebInstalled() && rrwebRecordFnCode) {
                    try {
                        window.eval(rrwebRecordFnCode);
                    } catch (e) {
                        return {
                            isRrwebSupported: false,
                            isRrwebInstalled: false,
                            rrwebEvents: [],
                            evalError: String(e),
                        };
                    }

                    // @ts-expect-error
                    window.lastProcessedRrwebEvent = -1;
                    // @ts-expect-error
                    window.rrwebEvents = [];
                    // @ts-expect-error
                    Object.defineProperty(window.rrwebEvents, "testplane", {
                        configurable: true,
                        value: {
                            isInstalledByTestplane: true,
                        },
                    });

                    // @ts-expect-error
                    window.rrwebEvents.testplane.stopRecording = window.rrweb.record({
                        // @ts-expect-error
                        emit(event) {
                            event.timestamp = getRealTimestamp(serverTime);

                            // @ts-expect-error
                            window.rrwebEvents.push(event);
                        },
                    });

                    const colorSchemeMedia = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");

                    // @ts-expect-error
                    window.rrweb.record.addCustomEvent("color-scheme-change", {
                        colorScheme: colorSchemeMedia && colorSchemeMedia.matches ? "dark" : "light",
                    });

                    if (colorSchemeMedia) {
                        const colorSchemeListener = (event: MediaQueryListEvent): void => {
                            // @ts-expect-error
                            window.rrweb.record.addCustomEvent("color-scheme-change", {
                                colorScheme: event.matches ? "dark" : "light",
                            });
                        };

                        colorSchemeMedia.addEventListener("change", colorSchemeListener);
                        // @ts-expect-error
                        window.rrwebEvents.testplane.colorSchemeMedia = colorSchemeMedia;
                        // @ts-expect-error
                        window.rrwebEvents.testplane.colorSchemeListener = colorSchemeListener;
                    }
                }
            } catch (e) {
                /**/
            }

            if (!isRrwebInstalled()) {
                return {
                    isRrwebInstalled: false,
                    rrwebEvents: [],
                };
            }

            return {
                isRrwebInstalled: true,
                rrwebEvents: getRrwebEvents(),
            };
        },
        rrwebRecordFnCode,
        Date.now(),
    );
}
/* eslint-enable @typescript-eslint/ban-ts-comment */

export function filterEvents(rrwebEvents: eventWithTime[]): eventWithTime[] {
    return rrwebEvents.filter(e => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dataAny = e?.data as any;
        // cd_frame_id_ attribute is specific for chromedriver and in rare cases can be captured by rrweb
        // It doesn't hold any value, and we want to get rid of it here.
        return !dataAny?.attributes?.[0]?.attributes?.["cd_frame_id_"];
    });
}

export function sendFilteredEvents(currentTest: Test | undefined, rrwebEvents: eventWithTime[]): void {
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
