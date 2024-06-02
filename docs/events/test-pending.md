# TEST_PENDING {#test-pending}

**sync | master**

The `TEST_PENDING` event is triggered if the test is disabled. The event handler is executed synchronously.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.TEST_PENDING, (test) => {
    console.info(
        `TEST_PENDING event is processed ` +
        `for test "${test.fullTitle()}" in browser "${test.browserId}"…`
    );
});
```

### Handler parameters {#handler-parameters}

The test instance is passed to the event handler.

## Usage {#usage}

See "[Collecting statistics about test runs](./usage-examples/collecting-stats.md)" for an example.