import _ from "lodash";
import { MasterEvents } from "./events";
import { Hermione } from "./hermione";

import type { Test } from "./types";

export interface StatsResult {
    total: number;
    passed: number;
    failed: number;
    retries: number;
    skipped: number;
    perBrowser: Record<string, Omit<StatsResult, "perBrowser">>;
}

type GroupName = Exclude<keyof StatsResult, "total" | "perBrowser">;

type StatEvent = {
    group: GroupName;
    id: string;
    browserId?: string;
};

export class Stats {
    private events: StatEvent[] = [];

    static create<T extends Stats>(this: new (runner?: Hermione) => T, runner?: Hermione): T {
        return new this(runner);
    }

    constructor(runner?: Hermione) {
        const pushEvent_ =
            (group: GroupName) =>
            ({ id, browserId }: Test): void => {
                this.events.push({ group, id, browserId });
            };

        if (runner) {
            runner
                .on(MasterEvents.TEST_PASS, pushEvent_("passed"))
                .on(MasterEvents.TEST_FAIL, pushEvent_("failed"))
                .on(MasterEvents.RETRY, pushEvent_("retries"))
                .on(MasterEvents.TEST_PENDING, pushEvent_("skipped"));
        }
    }

    getResult(): StatsResult {
        const emptyStat: Partial<StatsResult> = { passed: 0, failed: 0, retries: 0, skipped: 0, total: 0 };
        const statsByBrowser = _(this.events)
            .groupBy("browserId")
            .mapValues(events => {
                const stats = _(events).groupBy("group").mapValues("length").value();

                return {
                    ...emptyStat,
                    ...stats,
                    total: _.uniqBy(events, "id").length,
                };
            })
            .value();

        const overall = _.mergeWith(emptyStat, ...Object.values(statsByBrowser), (a: number, b: number) => a + b);

        return { ...overall, perBrowser: statsByBrowser };
    }
}
