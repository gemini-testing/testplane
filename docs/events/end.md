# END {#end}

**sync | master**

The `END` event is triggered just before the `RUNNER_END` event. The event handler is executed synchronously.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.END, () => {
    console.info('Handling the END event…');
});
```

### Handler parameters {#handler-parameters}

No data is passed to the event handler.

## Usage {#usage}

For an example of using the `END` event, see the section "[Delaying event processing](../events-interception.md#delaying-events)".