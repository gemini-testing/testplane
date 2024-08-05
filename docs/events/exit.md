# EXIT {#exit}

**async | master**

The `EXIT` event is triggered when the `SIGTERM` signal is received (for example, after pressing `Ctrl + C`). The event handler can be asynchronous.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.EXIT, async () => {
    console.info('Exit event is being processed…');
});
```

### Handler parameters {#handler-parameters}

No data is passed to the event handler.