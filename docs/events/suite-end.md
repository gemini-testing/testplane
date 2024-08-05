# SUITE_END {#suite-end}

**sync | master | interceptable**

The `SUITE_END` event is triggered after the _(suite)_ test suite has finished executing. The event handler is executed synchronously.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.SUITE_END, (suite) => {
    console.info(`Handling the SUITE_END event for "${suite.fullTitle()}"…`);
});
```

### Handler parameters {#handler-parameters}

The _suite_ instance is passed to the event handler.

## Intercepting event {#interception}

```javascript
testplane.intercept(testplane.events.SUITE_END, ({ event, data: suite }) => {
    console.info(`Intercepting SUITE_END event for "${suite.fullTitle()}"…`);
});
```