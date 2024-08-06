# Collecting statistics about test runs {#usage-collecting-stats}

Let's consider as an example [implementation][json-reporter-index] of the [json-reporter][json-reporter] plugin.

This example uses the following Testplane events:
* [TEST_PASS](../test-pass.md)
* [TEST_FAIL](../test-fail.md)
* [TEST_PENDING](../test-pending.md)
* [RETRY](../retry.md)
* [RUNNER_END](../runner-end.md)

```javascript
const Collector = require('./lib/collector');
const testplaneToolCollector = require('./lib/collector/tool/testplane');
const parseConfig = require('./lib/config');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled) {
        // plugin is disabled – leave
        return;
    }

    // collector will accumulate statistics
    const collector = Collector.create(testplaneToolCollector, pluginConfig);

    // subscribe to the corresponding events,
    // to eventually get the necessary statistics:

    // - how many tests were successfully completed
    testplane.on(testplane.events.TEST_PASS, (data) => collector.addSuccess(data));

    // - how many tests failed
    testplane.on(testplane.events.TEST_FAIL, (data) => collector.addFail(data));

    // - how many were disabled (skipped)
    testplane.on(testplane.events.TEST_PENDING, (data) => collector.addSkipped(data));

    // - number of retries
    testplane.on(testplane.events.RETRY, (data) => collector.addRetry(data));

    // after the test run is completed, save the statistics to a json file
    testplane.on(testplane.events.RUNNER_END, () => collector.saveFile());
};
```

[json-reporter]: https://github.com/gemini-testing/json-reporter
[json-reporter-index]: https://github.com/gemini-testing/json-reporter/blob/master/testplane.js
