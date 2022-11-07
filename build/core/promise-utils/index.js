'use strict';
const Promise = require('bluebird');
exports.waitForResults = (promises) => {
    return Promise.all(promises.map((p) => p.reflect()))
        .then((res) => {
        const firstRejection = res.find((v) => v.isRejected());
        return firstRejection ? Promise.reject(firstRejection.reason()) : res.map((r) => r.value());
    });
};
