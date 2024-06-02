# NEW_BROWSER {#new-browser}

**sync | worker**

The `NEW_BROWSER` event is triggered after a new browser instance is created. The event handler is executed synchronously. The event is available only in Testplane workers.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.NEW_BROWSER, (browser, { browserId, browserVersion }) => {
    console.info('Processing the NEW_BROWSER event…');
});
```

### Handler parameters {#handler-parameters}

Two arguments are passed to the event handler:
* the first argument is the `WebdriverIO` instance;
* the second argument is the an object of the form `{ browserId, versionId }`, where _browserId_ is the browser name, and _browserVersion_ is the browser version.

## Usage {#usage}

The `NEW_BROWSER` event is often used to add new commands to the browser, or somehow complement existing commands. For example, a plugin for debugging tests via VNC can add special commands _vncUrl_, _openVnc_ and _waitForEnter_ to the browser in the `NEW_BROWSER` event handler.

```javascript
module.exports = (testplane, opts) => {
    // ...

    if (testplane.isWorker()) {
        testplane.on(testplane.events.NEW_BROWSER, (browser, { browserId }) => {
            // ...

            browser.addCommand('vncUrl', vncUrlHandler);
            browser.addCommand('openVnc', createOpenVnc(browser, ipcOptions));
            browser.addCommand('waitForEnter', waitForEnter);
        });
    }
};
```