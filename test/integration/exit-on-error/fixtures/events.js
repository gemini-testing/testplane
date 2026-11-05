module.exports = testplane => {
    const counts = { retries: 0, failures: 0, errors: 0 };
    testplane.on(testplane.events.RETRY, () => counts.retries++);
    testplane.on(testplane.events.TEST_FAIL, () => counts.failures++);
    testplane.on(testplane.events.ERROR, () => counts.errors++);
    testplane.on(testplane.events.RUNNER_END, () => {
        console.log("EXIT_ON_ERROR_EVENTS:" + JSON.stringify(counts));
    });
};
