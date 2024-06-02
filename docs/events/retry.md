# RETRY {#retry}

**sync | master | can be intercepted**

The `RETRY` event is triggered if the test failed but was re-run, the so-called "retry". The test re-run capabilities are determined by the [retry][browsers-retry] and [shouldRetry][browsers-should-retry] settings in the Testplane config. Testplane plugins can also affect this if they modify the above settings "on the fly". See the [retry-limiter][retry-limiter] and [testplane-retry-progressive][testplane-retry-progressive] plugins for example.

The event handler is executed synchronously. The event can also be intercepted and changed in a special handler.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.RETRY, (test) => {
    console.info(
        `RETRY event is being processed ` +
        `for test "${test.fullTitle()}" in browser "${test.browserId}"…`
    );
});
```

### Handler parameters {#handler-parameters}

A test instance is passed to the event handler.

## Intercepting the event {#retry-interception}

```javascript
testplane.intercept(testplane.events.RETRY, ({ event, data: test }) => {
    console.info(
        `Intercepting the RETRY event ` +
        `for the test "${test.fullTitle()}" in the browser "${test.browserId}"…`
    );
});
```

## Usage {#usage}

See "[Collecting statistics about running tests](./usage-examples/collecting-stats.md)" for an example.

[browsers-retry]: ../config.md#retry
[browsers-should-retry]: ../config.md#shouldretry
[retry-limiter]: https://github.com/gemini-testing/retry-limiter
[testplane-retry-progressive]: https://github.com/gemini-testing/testplane-retry-progressive
