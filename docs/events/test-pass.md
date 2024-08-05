# TEST_PASS {#test-pass}

**sync | master | interceptable**

Event `TEST_PASS` is triggered if test succesfully passed. The event handler is executed synchronously. The event can also be intercepted and modified in a special handler.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.TEST_PASS, (test) => {
    console.info(
        `TEST_PASS event is being processed ` +
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

See "[Collecting statistics about test runs](./usage-examples/collecting-stats.md)" for an example.