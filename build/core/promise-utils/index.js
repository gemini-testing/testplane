"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForResults = void 0;
const waitForResults = async (promises) => {
    const res = await Promise.all(promises.map((p) => p.reflect()));
    const firstRejection = res.find((v) => v.isRejected());
    return firstRejection ? Promise.reject(firstRejection.reason()) : res.map((r) => r.value());
};
exports.waitForResults = waitForResults;
