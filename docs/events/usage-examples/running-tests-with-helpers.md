# Running tests with helpers {#running-tests-with-helpers}

Let's look at the [implementation][testplane-passive-browsers-index] of the [testplane-passive-browsers][testplane-passive-browsers] plugin.

Using the [BEFORE_FILE_READ](../before-file-read.md) and [AFTER_TESTS_READ](../after-tests-read.md) events, the plugin allows you to add a special helper that can be used to run specified tests or test suites _(suites)_ in specified browsers. This logic can be useful if you don't need to run most of your tests in some browsers. But you still want to run some tests in these (passive) browsers to check browser-specific things.

In the example below, we have simplified the plugin code a bit by setting the `also` helper name directly in the code, rather than taking it from the plugin config.

This example uses the following Testplane events:
* [BEFORE_FILE_READ](../before-file-read.md)
* [AFTER_TESTS_READ](../after-tests-read.md)

Plugin code:

```javascript
const _ = require('lodash');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled) {
        // plugin is disabled – exit
        return;
    }

    if (testplane.isWorker()) {
        testplane.on(testplane.events.BEFORE_FILE_READ, ({ testParser }) => {
            // the helper will not do anything in workers,
            // set "no operation" for it
            testParser.setController('also', { in: _.noop });
        });

        return;
    }

    const suitesToRun = {};
    const testsToRun = {};

    testplane.on(testplane.events.BEFORE_FILE_READ, ({ testParser }) => {
        testParser.setController('also', {
            // matcher is a parameter that is passed to the helper also.in();
            // can be a string, a regular expression, or an array of strings/regexp;
            // in our case, matcher determines passive browsers in
            // which the test(s) should be run
            in: function(matcher) {
                const storage = this.suites ? suitesToRun : testsToRun;

                if (!shouldRunInBro(this.browserId, matcher)) {
                    // if the current browser is not in the list
                    // specified in the helper, then do nothing
                    return;
                }

                if (!storage[this.browserId]) {
                    storage[this.browserId] = [];
                }

                // otherwise we collect test IDs,
                // which should be launched for the current browser
                storage[this.browserId].push({ id: this.id() });
            }
        });
    });

    // use prependListener to initially enable tests only in the specified passive browsers, and then all other tests that
    // should be enabled will be enabled
    testplane.prependListener(testplane.events.AFTER_TESTS_READ, (testCollection) => {
        // form a list of passive browsers as the intersection of browsers for tests that
        // were read and browsers from the plugin config
        const passiveBrowserIds = getPassiveBrowserIds(testCollection, pluginConfig);

        passiveBrowserIds.forEach((passiveBrowserId) => {
            const shouldRunTest = (runnable, storage = testsToRun) => {
                const foundRunnable = runnable.id && _.find(storage[passiveBrowserId], { id: runnable.id() });

                return foundRunnable || runnable.parent && shouldRunTest(runnable.parent, suitesToRun);
            };

            // disable all tests except those that should be run
            // in the specified passive browsers
            testCollection.eachTest(browserId, (test) => {
                test.disabled = !shouldRunTest(test);
            });
        });
    });
};
```

Test code:

```javascript
testplane.also.in('ie6');

describe('suite', () => {
    it('test1', function() {
        // ...
    });

    testplane.also.in(['ie7', /ie[89]/]);
    it('test2', function() {
        // ...
    });
});
```

[testplane-passive-browsers-index]: https://github.com/gemini-testing/testplane-passive-browsers/blob/master/lib/index.js
[testplane-passive-browsers]: https://github.com/gemini-testing/testplane-passive-browsers