# SESSION_END {#session-end}

**async | master**

The `SESSION_END` event is triggered after the browser session ends. The event handler can be asynchronous: in this case, tests will continue to run only after the _Promise_ returned by the event handler is resolved.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.SESSION_END, async (browser, { browserId, sessionId }) => {
    console.info('Processing the SESSION_END event…');
});
```

### Handler parameters {#handler-parameters}

Two arguments are passed to the event handler:
* the first argument is a `WebdriverIO` instance;
* the second argument is an object of the form `{ browserId, sessionId }`, where _browserId_ is the browser name and _sessionId_ is the browser session ID.