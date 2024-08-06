# Running tests from a specified list {#usage_running_filtered_tests}

Let's consider as an example [implementation][testplane-test-filter-index] of the [testplane-test-filter][testplane-test-filter] plugin, with which you can run only the tests specified in the json file.

This example uses the following Testplane API events and methods:
* [INIT](../init.md)
* [AFTER_TESTS_READ](../after-tests-read.md)
* `TestCollection.disableAll`
* `TestCollection.enableTest`


```javascript
const _ = require('lodash');
const parseConfig = require('./config');
const utils = require('./utils');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled) {
        // plugin is disabled – leave
        return;
    }

    if (testplane.isWorker()) {
        // we have nothing to do in testplane workers – leave
        return;
    }

    let input;

    testplane.on(testplane.events.INIT, async () => {
        // read a file with a list of tests to run;
        // readFile returns json, which contains an array of the following type:
        // [
        // { "fullTitle": "test-1", "browserId": "bro-1" },
        // { "fullTitle": "test-2", "browserId": "bro-2" }
        // ]
        input = await utils.readFile(pluginConfig.inputFile);
    });

    testplane.on(testplane.events.AFTER_TESTS_READ, (testCollection) => {
        if (_.isEmpty(input)) {
            // the list of tests is empty - we will run all tests,
            // that is, we do not touch the original collection (testCollection) of tests
            return;
        }

        // we disable all tests
        testCollection.disableAll();

        // and now we enable only those that were passed in the json file
        input.forEach(({ fullTitle, browserId }) => {
            testCollection.enableTest(fullTitle, browserId);
        });
    });
};
```

[testplane-test-filter-index]: https://github.com/gemini-testing/testplane-test-filter/blob/master/lib/index.js
[testplane-test-filter]: https://github.com/gemini-testing/testplane-test-filter