# TEST_BEGIN {#test-begin}

**sync | master | interceptable**

The `TEST_BEGIN` event is triggered before the test is executed. The event handler is executed synchronously.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.TEST_BEGIN, (test) => {
    if (test.pending) {
        // the test is disabled, nothing needs to be done
        return;
    }

    console.info(
        `Handling the TEST_BEGIN event is performed ` +
        `for the test "${test.fullTitle()}" in the browser "${test.browserId}"…`
    );
});
```

### Handler parameters {#handler-parameters}

The test instance is passed to the event handler.

## Intercepting the event {#interception}

```javascript
testplane.intercept(testplane.events.TEST_BEGIN, ({ event, data: test }) => {
    console.info(
        `Intercepting the TEST_BEGIN event ` +
        `for the test "${test.fullTitle()}" in the browser "${test.browserId}"…`
    );
});
```

## Usage {#usage}

See "[Profiling test runs](./usage-examples//profiling-tests-runs.md)" for an example.