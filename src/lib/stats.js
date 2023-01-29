"use strict";

const _ = require("lodash");
const RunnerEvents = require("./constants/runner-events");

module.exports = class Stats {
    static create(...args) {
        return new this(...args);
    }

    constructor(runner) {
        this._events = [];

        const pushEvent_ = (group) =>
            ({ id, browserId }) => this._events.push({ group, id, browserId });

        runner && runner
            .on(RunnerEvents.TEST_PASS, pushEvent_("passed"))
            .on(RunnerEvents.TEST_FAIL, pushEvent_("failed"))
            .on(RunnerEvents.RETRY, pushEvent_("retries"))
            .on(RunnerEvents.TEST_PENDING, pushEvent_("skipped"));
    }

    getResult() {
        const emptyStat = { passed: 0, failed: 0, retries: 0, skipped: 0, total: 0 };
        const statsByBrowser = _(this._events)
            .groupBy("browserId")
            .mapValues((events) => {
                const stats = _(events)
                    .groupBy("group")
                    .mapValues("length")
                    .value();

                return {
                    ...emptyStat,
                    ...stats,
                    total: _.uniqBy(events, "id").length,
                };
            })
            .value();

        const overall = _.mergeWith(
            emptyStat,
            ...Object.values(statsByBrowser),
            (a, b) => a + b,
        );

        return { ...overall, perBrowser: statsByBrowser };
    }
};
