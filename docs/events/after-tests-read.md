# AFTER_TESTS_READ {#after-tests-read}

**sync | master | worker**

The `AFTER_TESTS_READ` event is triggered after the `readTests` or `run` methods of the `TestCollection` object are called. The event handler is executed synchronously. The event is also available in Testplane workers.

By subscribing to this event, you can perform certain manipulations on the test collection in the handler before they are run. For example, you can exclude some tests from runs.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.AFTER_TESTS_READ, (testCollection) => {
    console.info('AFTER_TESTS_READ event is being processed…');
});
```

### Handler parameters {#handler-parameters}

The event handler is passed a `testCollection` object of type [`TestCollection`](../programmatic-api.md#test-collection).

## Usage {#usage}

Let's consider the [implementation][testplane-global-hook-index] of the [testplane-global-hook][testplane-global-hook] plugin, which can be used to separate actions that are repeated before starting and ending each test into separate _beforeEach_ and _afterEach_ handlers.

Using the `AFTER_TESTS_READ` event, the plugin adds _beforeEach_ and _afterEach_ hook handlers to each root _suite_. The latter are specified by the user in the [testplane-global-hook][testplane-global-hook] plugin config.


```javascript
const parseConfig = require('./config');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    // ...

    const { beforeEach, afterEach } = pluginConfig;

    testplane.on(testplane.events.AFTER_TESTS_READ, (testCollection) => {
        testCollection.eachRootSuite((root) => {
            beforeEach && root.beforeEach(beforeEach);
            afterEach && root.afterEach(afterEach);
        });
    });
};
```


More examples of using the `AFTER_TESTS_READ` event can be found in the sections "[Running tests from a specified list](#usage_running_filtered_tests)" and "[Running tests with helpers](#usage_running_tests_with_helpers)".

[testplane-global-hook-index]: https://github.com/gemini-testing/testplane-global-hook/blob/master/index.js
[testplane-global-hook]: https://github.com/gemini-testing/testplane-global-hook