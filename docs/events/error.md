# ERROR {#error}

**sync | master**

The `ERROR` event is triggered only from event interceptors in case of a critical error. The event handler is executed synchronously.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.ERROR, (error) => {
    console.info('Handling the ERROR event…');
});
```

### Handler parameters {#handler-parameters}

The error object is passed to the event handler.

## Usage {#usage}

See "[Profiling test runs](./usage-examples/profiling-tests-runs.md)" for an example.