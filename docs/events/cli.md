# CLI {#cli}

**sync | master**

The `CLI` event is triggered immediately on startup, before Testplane parses the CLI. The event handler is executed synchronously. You can use it to add new commands or extend Testplane's help.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.CLI, (cli) => {
    console.info('CLI event is being processed…');

    cli.option(
        '--some-option <some-value>',
        'the full description of the option',
        // see more details at https://github.com/tj/commander.js#options
    );
});
```

### Handler parameters {#handler-parameters}

An object of the [Commander][commander] type is passed to the event handler.

## Example of using {#usage}

Let's consider as an example [implementation][test-repeater-index] of the [testplane-test-repeater][test-repeater] plugin.

Using the `CLI` event, the plugin adds a new option to Testplane `--repeat`. With it, you can specify how many times to run tests, regardless of the result of each run.


```javascript
const parseConfig = require('./config');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled || testplane.isWorker()) {
        // either the plugin is disabled, or we are in the worker context - leave
        return;
    }

    testplane.on(testplane.events.CLI, (cli) => {
        // add the --repeat option
        cli.option(
            '--repeat <number>',
        'how many times tests should be repeated regardless of the result',
        (value) => parseNonNegativeInteger(value, 'repeat')
        );
    });

    // ...
};
```

[commander]: https://github.com/gemini-testing/commander.js
[test-repeater-index]: https://github.com/gemini-testing/testplane-test-repeater/blob/master/lib/index.js
[test-repeater]: https://github.com/gemini-testing/testplane-test-repeater