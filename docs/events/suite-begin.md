# SUITE_BEGIN {#suite-begin}

**sync | master | interceptable**

The `SUITE_BEGIN` event is triggered before the _(suite)_ test suite is executed. The event handler is executed synchronously.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.SUITE_BEGIN, (suite) => {
    console.info(`Handling the SUITE_BEGIN event for "${suite.fullTitle()}"…`);
});
```

### Handler parameters {#handler-parameters}

The _suite_ instance is passed to the event handler.

## Intercepting event {#interception}

```javascript
testplane.intercept(testplane.events.SUITE_BEGIN, ({ event, data: suite }) => {
    console.info(`Intercepting SUITE_BEGIN event for "${suite.fullTitle()}"…`);
});
```