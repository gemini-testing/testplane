# TEST_END {#test-end}

**sync | master | interceptable**

The `TEST_END` event is triggered after the test execution is finished (after events `TEST_FAIL`, `RETRY`, etc). The event handler is executed synchronously. The event can also be intercepted and changed in a special handler.

## Event subscription {#test_end_subscription}

```javascript
testplane.on(testplane.events.TEST_END, (test) => {
    if (test.pending) {
        // the test is disabled, nothing needs to be done
        return;
    }

    console.info(
        `TEST_END event is being processed ` +
        `for test "${test.fullTitle()}" in browser "${test.browserId}"…`
    );
});
```

### Handler parameters {#handler-parameters}

The test instance is passed to the event handler.

## Intercepting the event {#interception}

```javascript
testplane.intercept(testplane.events.TEST_END, ({ event, data: test }) => {
    console.info(
        `Intercepting the TEST_END event ` +
        `for the test "${test.fullTitle()}" in the browser "${test.browserId}"…`
    );
});
```

## Usage {#usage}

See "[Profiling test runs](./usage-examples/profiling-tests-runs.md)" for an example.