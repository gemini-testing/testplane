# AFTER_FILE_READ {#after-file-read}

**sync | master | worker**

The `AFTER_FILE_READ` event is triggered after the test file is read. The event handler is executed synchronously. The event is also available in Testplane workers.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.AFTER_FILE_READ, ({ file, testplane }) => {
    console.info('AFTER_FILE_READ event is being processed…');
});
```

### Handler parameters {#handler-parameters}

An object of the following format is passed to the event handler:

```javascript
{
    file, // String: path to the file with the test
    testplane // Object: same as global.testplane
}
```