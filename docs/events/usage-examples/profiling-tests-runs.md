# Profiling test runs {#profiling-tests-runs}

Let's look at a schematic implementation of profiling a test run. Each time a test is launched, we will record its launch time, and when it is finished, we will record its completion time. We will save all the information to a stream, which will be closed upon completion of the runner.

```javascript
const parseConfig = require('./lib/config');
const StreamWriter = require('./lib/stream-writer');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled) {
        // the plugin is disabled - leave
        return;
    }

    let writeStream;

    testplane.on(testplane.events.RUNNER_START, () => {
        // create a stream to write profiling data
        writeStream = StreamWriter.create(pluginConfig.path);
    });

    testplane.on(testplane.events.TEST_BEGIN, (test) => {
        if (test.pending) {
            // test is disabled - nothing needs to be done
            return;
        }

        // time the test start
        test.timeStart = Date.now();
    });

    testplane.on(testplane.events.TEST_END, (test) => {
        if (test.pending) {
            // test is disabled - nothing needs to be done
            return;
        }

        // time the test end time
        test.timeEnd = Date.now();
        // and save the test information to the stream
        writeStream.write(test);
    });

    // in case of an error, close the stream
    testplane.on(testplane.events.ERROR, () => writeStream.end());

    // after the runner is finished, close the stream
    testplane.on(testplane.events.RUNNER_END, () => writeStream.end());
};
```

A more detailed [implementation](https://github.com/gemini-testing/testplane-profiler/blob/master/index.js) can be found in the [testplane-profiler](https://github.com/gemini-testing/testplane-profiler) plugin.