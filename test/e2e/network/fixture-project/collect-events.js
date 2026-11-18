"use strict";

const fs = require("node:fs");

const readBody = ({ bodyFilePath } = {}) => bodyFilePath && fs.readFileSync(bodyFilePath, "utf8");

module.exports = testplane => {
    const summary = { passes: [], domSnapshots: 0, network: [] };
    const { TEST_PASS, DOM_SNAPSHOTS, NETWORK_REQUESTS, RUNNER_END } = testplane.events;

    testplane.on(TEST_PASS, test => summary.passes.push(test.fullTitle()));
    testplane.on(DOM_SNAPSHOTS, (_, data) => {
        summary.domSnapshots += data.rrwebSnapshots.length;
    });
    testplane.on(NETWORK_REQUESTS, (context, { requests }) => {
        const fixtureRequests = requests.filter(({ url }) => {
            const { origin, pathname } = new URL(url);
            return origin === process.env.NETWORK_E2E_URL && ["/redirect", "/echo"].includes(pathname);
        });
        summary.network.push({
            context,
            requests: fixtureRequests.map(request => ({
                ...request,
                body: readBody(request),
                response: request.response && { ...request.response, body: readBody(request.response) },
            })),
        });
    });
    testplane.on(RUNNER_END, () => fs.writeFileSync(process.env.NETWORK_E2E_OUTPUT, JSON.stringify(summary)));
};
