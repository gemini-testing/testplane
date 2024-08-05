# Testplane Events

## Overview {#overview}

### Disclaimer {#disclaimer}

Below are all the events of Testplane that you can subscribe to in your plugin.

The description of each event begins with tags, which are represented by the following options:

* _sync_ or _async_ indicate, respectively, the synchronous and asynchronous modes of calling the event handler;
* _master_ indicates that this event is available from the Tesplane master process;
* _worker_ indicates that this event is available from Tesplane workers (subprocesses);
* _interceptable_ indicates that this event can be intercepted and, accordingly, changed.

Next come:
* a description of the circumstances under which the event is triggered;
* a snippet with code showing how to subscribe to it;
* event handler parameters;
* and optionally, examples of using this event in a plugin or plugins.

## Events scheme {#events-scheme}

TBD

### Events scheme description {#events-scheme-description}

Testplane can be launched either via the [CLI (command line)](https://testplane.io/docs/v8/command-line) or via its API: from a script using the `run` command.

After launching, Testplane loads all plugins and proceeds to CLI parsing if it was launched via the CLI, or directly to the initialization stage if it was launched via the API.

#### CLI Parsing {#cli-parsing}

If Testplane was launched via CLI, it will trigger the [CLI](./cli.md) event. Any plugin can subscribe to this event to add its options and commands to Testplane before Testplane parses the CLI.

If Testplane was launched via API, the CLI parsing stage will be skipped and the initialization stage will start immediately.

#### Initialization {#initialization}

During initialization, Testplane triggers the [INIT](./init.md) event. This event is triggered only once during the entire Testplane launch. By subscribing to this event, plugins can perform all the necessary preparatory work: open and read some files, start a dev server, initialize data structures, etc.

Then Testplane launches subprocesses (the so-called workers), within which all tests will be executed. In the Testplane master process, tests are not executed, but only the general orchestration of the entire test launch process is performed, including the generation of events upon completion of individual tests.

The number of workers that Testplane launches is regulated by the [workers][system-workers] parameter in the [system][system] section of the Testplane config. When starting a new worker, Testplane triggers a special event [NEW_WORKER_PROCESS][new-worker-process].

Testplane runs all tests in workers to avoid memory and CPU limitations for the master process. As soon as the number of tests executed in a worker reaches [testsPerWorker][system-tests-per-worker], the worker will finish its work and a new worker will be started. Accordingly, the event [NEW_WORKER_PROCESS][new-worker-process] will be sent again.

#### Reading tests {#reading-tests}

After this, Testplane reads all tests from the file system in the master process. Sending for each file, before reading it, the [BEFORE_FILE_READ](./before-file-read.md) event and after reading it - the [AFTER_FILE_READ](./after-file-read.md) event.

After all tests have been read, the [AFTER_TESTS_READ](./after-tests-read.md) event is triggered.

#### Running tests {#running-tests}

Then Testplane sends the [RUNNER_START](./runner-start.md) and [BEGIN](./begin.md) events. And starts a new session (browser session) in which the tests will be executed. When starting a session, Testplane triggers the [SESSION_START](./session-start.md) event.

If the number of tests executed within one session reaches the value of the [testsPerSession][browser-tests-per-session] parameter, Testplane will end the session by triggering the [SESSION_END](./session-end.md) event, and start a new one by sending the [SESSION_START](./session-start.md) event.

If the test fails with a critical error during execution, Testplane:
- prematurely deletes the session and the browser associated with it;
- creates a new session;
- will request a new browser and bind it to a new session.

This is necessary so that a session failure during one of the tests does not affect the launch of subsequent tests.

{% endnote %}

After creating a new session, Testplane proceeds to running tests. All tests are run in workers, but the launch and collection of test results is carried out within the master process. The master process triggers the [SUITE_BEGIN](./suite-begin.md) event for describe blocks in the test file and [TEST_BEGIN](./test-begin.md) for it blocks. If the test is disabled using helpers like `skip.in` and the like, the [TEST_PENDING](./test-pending.md) event is triggered.

Then the workers receive information from the master process about the specific tests they must run. Since the tests are stored in files, the workers read the specific files that contain the required tests. And before reading each such file, the [BEFORE_FILE_READ](./before-file-read.md) event is triggered in each worker, and after reading - the [AFTER_FILE_READ](./after-file-read.md) event.

After the corresponding test files are read by the worker, the [AFTER_TESTS_READ](./after-tests-read.md) event is triggered.

The listed 3 events - [BEFORE_FILE_READ](./before-file-read.md), [AFTER_FILE_READ](./after-file-read.md) and [AFTER_TESTS_READ](./after-tests-read.md) will be triggered in the workers during the test run each time the workers receive the next tests from the master process that need to be run. Except for cases when the corresponding test file has already been read by the worker earlier. Because after reading a file for the first time, the worker saves it in the cache to avoid re-reading the file with tests next time.

Why can a file be requested multiple times? Because one file can contain multiple tests. And tests are run on individual tests, not on files. Therefore, at some point in time, a test can be run from a file from which another test has already been run. In such cases, caching protects against unnecessary repeated readings of the same files.

Before the test is run, the [NEW_BROWSER](./new-browser.md) event is triggered. However, this event will not be triggered for all tests, since the same browser can be used multiple times to run tests (see the [sessionsPerBrowser][browser-sessions-per-browser] parameter). Also, if a test fails with a critical error, the browser is recreated to prevent other tests in this browser from failing due to a system failure. In this case, the [NEW_BROWSER](./new-browser.md) event will be sent again.

#### Completing tests {#completing-tests}

After a test is completed, a [SESSION_END](./session-end.md) event can be sent. But this is only if the total number of tests that were launched in the used session exceeded the [testsPerSession][browser-tests-per-session] value.

Everything will depend on the result of the test run. If the test was successful, then Testplane triggers the [TEST_PASS](./test-pass.md) event. If the test failed, it triggers the [TEST_FAIL](./test-fail.md) event. If the test failed, it triggers the [TEST_FAIL](./test-fail.md) event. If the test failed, but it should be re-run (see the [retry][browsers-retry] and [shouldRetry][browsers-should-retry] settings in the Testplane config), then instead of the [TEST_FAIL](./test-fail.md) event, the [RETRY](./retry.md) event will be sent.

If the test does not need to be re-run and the result is final, then Testplane triggers the events [TEST_END](./test-end.md) and [SUITE_END](./suite-end.md), if we are talking about the end of the describe block execution.

After all tests are executed and sessions are finished, Testplane triggers the events [END](./end.md) and [RUNNER_END](./runner-end.md).

#### Updating reference screenshots {#updating-reference-screenshots}

When running tests, reference screenshots may be updated. This may happen for the following reasons:
- the developer launched Testplane in a special GUI mode and gave the command "accept screenshots";
- the developer specified the `--update-ref` option when launching Testplane;
- the tests did not have reference screenshots.

In all these cases, the [UPDATE_REFERENCE](./update-reference.md) event is triggered.

#### Errors and crashes {#errors-and-crashes}

If a critical error occurs in [one of the event interceptors](./events-interception.md) during a test run, then Testplane will trigger an [ERROR](./error.md) event for that test. The rest of the tests will run normally.

If Testplane receives a [SIGTERM][sigterm] signal (for example, by pressing `Ctrl + C`), then Testplane will trigger an [EXIT](./exit.md) event and prematurely terminate the tests.


[system]: https://testplane.io/docs/v8/config/system/
[system-workers]: https://testplane.io/docs/v8/config/system/#workers
[system-tests-per-worker]: https://testplane.io/docs/v8/config/system/#tests_per_worker
[new-worker-process]: ./new-worker-process.md
[browser-tests-per-session]: https://testplane.io/docs/v8/config/browsers/#tests_per_session
[browser-sessions-per-browser]: https://testplane.io/docs/v8/config/browsers/#sessions_per_browser
[browsers-retry]: https://testplane.io/docs/v8/config/browsers/#retry
[browsers-should-retry]: https://testplane.io/docs/v8/config/browsers/#should_retry
[sigterm]: https://en.wikipedia.org/wiki/Signal_(IPC)#SIGTERM
