# UPDATE_REFERENCE {#update-reference}

**sync | worker**

The `UPDATE_REFERENCE` event is triggered after updating reference screenshots. The event handler is executed synchronously. The event is available only in Testplane workers.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.UPDATE_REFERENCE, ({ state, refImg }) => {
    console.info('Processing the UPDATE_REFERENCE event…');
});
```

### Handler parameters {#handler-parameters}

An object of the following format is passed to the event handler:

```javascript
{
    state, // String: the state that this screenshot reflects, for example: plain, map-view, scroll-left, etc.
    refImg // Object: of type { path, size: { width, height } }, describing the reference screenshot
}
```

The _refImg.path_ parameter stores the path to the reference screenshot on the file system, and _refImg.size.width_ and _refImg.size.height_ store, respectively, the width and height of the reference screenshot.

## Usage {#usage}

As an example, let's consider the [implementation][testplane-image-minifier-index] of the [testplane-image-minifier][testplane-image-minifier] plugin, in which, when saving reference screenshots, they are automatically compressed with a specified compression level.


```javascript
const parseConfig = require('./config');
const Minifier = require('./minifier');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled) {
        // the plugin is disabled - leave
        return;
    }

    const minifier = Minifier.create(pluginConfig);

    testplane.on(testplane.events.UPDATE_REFERENCE, ({ refImg }) => {
        minifier.minify(refImg.path);
    });
};
```

[testplane-image-minifier]: https://github.com/gemini-testing/testplane-image-minifier
[testplane-image-minifier-index]: https://github.com/gemini-testing/testplane-image-minifier/blob/master/lib/index.js
