# Changelog

## 0.14.0 - 2016-10-05

* Added configparser which is intended to verify configuration file and provides an opportunity to override config values through cli and environment variables
* Show fallen tests at the end of the reporter
* Added file path to the fallen tests at the end of the reporter
* Show correct errors which might be occur by connecting plugins
* Fixed bug with double slashes in meta url

## 0.13.0 - 2016-09-07

* Show tests in reports if they were skipped by the HERMIONE_SKIP_BROWSERS
environment variable
* Fixed files read error, when files in specs were specified as string.

## 0.12.0 - 2016-08-22

* Added passing of execution context to a browser instance in tests (see the [documentation](https://github.com/gemini-testing/hermione/blob/v0.12.0/README.md#execution-context) for more details)
* Added `SESSION_START` and `SESSION_END` events
* Fix: do not launch browsers for skipped tests

## 0.11.4 - 2016-08-11

* Switch to webdriverio@4.2.4

## 0.11.3 - 2016-08-11

* Switch to webdriverio master with `screenshotOnReject` option

## 0.11.2 - 2016-08-08

* Fix: throw error on incorrect path to test suites
* Fix: save whole url in meta info

## 0.11.1 - 2016-08-05

* Switch to the stable webdriverio version (screenshots will not be saved on reject now)

## 0.11.0 - 2016-08-01

* Added capability to run tests matched by masks

## 0.10.0 - 2016-08-01

* Added test metainfo access methods to webdriverio
* Save latest url opened by webdriverio in metainfo

## 0.9.1 - 2016-07-12

* Passthrough `screenshotOnReject` option to `webdriverio`

## 0.9.0 - 2016-07-12

* Added event `SUITE_FAIL` which is emitted instead of event `ERROR` when `before all` hook fails.

## 0.8.1 - 2016-07-04

* Added environment variable [HERMIONE_SKIP_BROWSERS](https://github.com/gemini-testing/hermione/blob/v0.8.1/README.md#hermione_skip_browsers).

## 0.8.0 - 2016-06-30

* Update webdriver.io to 4.1.0
* Decrease default waitTimeout value to 1000 ms

## 0.7.0 - 2016-05-12

* Added [skip API](https://github.com/gemini-testing/hermione/blob/v0.7.0/README.md#skip)
* Dropped supporting of node < 4.x

## 0.6.3 - 2016-05-04

* Update webdriver.io version to v4.0.4

## 0.6.2 - 2016-04-27

* Fixed retrying all suite tests on single test fail

## 0.6.1 - 2016-04-01

* Fixed crash on attempt to retry test.

## 0.6.0 - 2016-03-30

* Supported configuration of `specs` for certain browsers (see [#9]).
* Added option `--grep` for selecting specific tests (see [#15]).
* Improved documentation: translated from Russian to English and updated several sections.
* Fixed crash when enabling debug mode (see [#10]).

## 0.5.3 - 2016-03-04

* Correct exit code when config file is corrupted

## 0.5.2 - 2016-02-20

* Avoid `possible EventEmitter memory leak detected` warning in signalHandler
* Fix session ids in reporters

## 0.5.1 - 2016-02-18

* Fixed `NoSessionIdError` in parallel run

## 0.5.0 - 2016-02-17
* Plugin support added
* Retry logic added
* Better error logging
* Fixed `.only` option for tests
* Quit browsers on `Ctrl + C`

## 0.4.0 - 2016-01-28

* `capabilities` renamed to `desiredCapabilities`

## 0.3.3 - 2016-01-28

* `webdriverio` switched to v3.4.x version

## 0.3.2 - 2016-01-15

* Up lodash to version with `defaultsDeep`

## 0.3.1 - 2016-01-15

* Avoid 'possible EventEmitter memory leak detected' warning

## 0.3.0 - 2016-01-15

* `webdriverio` switched to master branch
* Allways show errors in logs
* Do not save screenshots on webdriver error by default
* Ability to set mocha options in config
* Up q-io and q version to 2.x

## 0.2.0 - 2016-01-13

* Add ability to run tests in specific browsers
* Allow unknown option for cli

## 0.1.0 - 2016-01-12

* Initial release

[#15]: https://github.com/gemini-testing/hermione/pull/15
[#10]: https://github.com/gemini-testing/hermione/pull/10
[#9]: https://github.com/gemini-testing/hermione/pull/9
