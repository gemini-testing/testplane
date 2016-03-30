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
