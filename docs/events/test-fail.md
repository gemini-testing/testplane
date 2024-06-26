# TEST_FAIL {#test-fail}

**sync | master | can be intercepted**

The `TEST_FAIL` event is triggered if the test fails. The event handler is executed synchronously. The event can also be intercepted and modified in a special handler.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.TEST_FAIL, (test) => {
    console.info(
        `TEST_FAIL event is being processed ` +
        `for test "${test.fullTitle()}" in browser "${test.browserId}"…`
    );
});
```

### Handler parameters {#handler-parameters}

The test instance is passed to the event handler.

## Intercepting the event {#interception}

```javascript
testplane.intercept(testplane.events.TEST_FAIL, ({ event, data }) => {
    console.info(
        `Intercepting the TEST_PASS event ` +
        `for the test "${test.fullTitle()}" in the browser "${test.browserId}"…`
    );
});
```

## Usage {#usage}

See "[Collecting statistics about running tests](./usage-examples/collecting-stats.md)" for an example.