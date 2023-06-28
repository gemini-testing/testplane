"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stats = void 0;
const lodash_1 = __importDefault(require("lodash"));
const events_1 = require("./events");
class Stats {
    static create(runner) {
        return new this(runner);
    }
    constructor(runner) {
        this.events = [];
        const pushEvent_ = (group) => ({ id, browserId }) => {
            this.events.push({ group, id, browserId });
        };
        if (runner) {
            runner
                .on(events_1.MasterEvents.TEST_PASS, pushEvent_("passed"))
                .on(events_1.MasterEvents.TEST_FAIL, pushEvent_("failed"))
                .on(events_1.MasterEvents.RETRY, pushEvent_("retries"))
                .on(events_1.MasterEvents.TEST_PENDING, pushEvent_("skipped"));
        }
    }
    getResult() {
        const emptyStat = { passed: 0, failed: 0, retries: 0, skipped: 0, total: 0 };
        const statsByBrowser = (0, lodash_1.default)(this.events)
            .groupBy("browserId")
            .mapValues(events => {
            const stats = (0, lodash_1.default)(events).groupBy("group").mapValues("length").value();
            return {
                ...emptyStat,
                ...stats,
                total: lodash_1.default.uniqBy(events, "id").length,
            };
        })
            .value();
        const overall = lodash_1.default.mergeWith(emptyStat, ...Object.values(statsByBrowser), (a, b) => a + b);
        return { ...overall, perBrowser: statsByBrowser };
    }
}
exports.Stats = Stats;
//# sourceMappingURL=stats.js.map