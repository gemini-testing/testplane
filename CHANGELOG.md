# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="0.34.0"></a>
# [0.34.0](https://github.com/gemini-testing/hermione/compare/v0.25.0...v0.34.0) (2017-04-22)


### Bug Fixes

* 'global.hermione' is not defined when reading tests via 'readTests' ([64ff66a](https://github.com/gemini-testing/hermione/commit/64ff66a))
* add correct error handling in before and beforeEach hooks ([561342a](https://github.com/gemini-testing/hermione/commit/561342a))
* Boolean env and cli vars reading ([fb5e932](https://github.com/gemini-testing/hermione/commit/fb5e932))
* bug with file path on 'before all' hook ([a3ffee7](https://github.com/gemini-testing/hermione/commit/a3ffee7))
* Do not save whole runnable object - decrease memory leaks ([d1c0224](https://github.com/gemini-testing/hermione/commit/d1c0224))
* fail instead of hang on throws from event handlers ([6c1706a](https://github.com/gemini-testing/hermione/commit/6c1706a))
* ignore failed tests from mocha ([bd41074](https://github.com/gemini-testing/hermione/commit/bd41074))
* Make sync and async events pass through separately ([87722ba](https://github.com/gemini-testing/hermione/commit/87722ba))
* the output to file path on 'before all' hook ([1378e75](https://github.com/gemini-testing/hermione/commit/1378e75))


### Features

* Add hermione.only.notIn() helper ([17b4453](https://github.com/gemini-testing/hermione/commit/17b4453))
* Add optional "meta" field for browser config ([3a80d66](https://github.com/gemini-testing/hermione/commit/3a80d66))
* add plain reporter ([3d30df9](https://github.com/gemini-testing/hermione/commit/3d30df9))
* BEFORE_FILE_READ and AFTER_FILE_READ events ([f2a5593](https://github.com/gemini-testing/hermione/commit/f2a5593))
* load plugins and pass events when reading files ([b402217](https://github.com/gemini-testing/hermione/commit/b402217))
* make browser.url work like url.resolve ([727f78d](https://github.com/gemini-testing/hermione/commit/727f78d))
* pass mocha suite on 'beforeFileRead' and 'afterFileRead' events ([3e25894](https://github.com/gemini-testing/hermione/commit/3e25894))



<a name="0.33.0"></a>
# [0.33.0](https://github.com/gemini-testing/hermione/compare/v0.31.0...v0.33.0) (2017-04-05)


### Features

* Add optional "meta" field for browser config ([3a80d66](https://github.com/gemini-testing/hermione/commit/3a80d66))
* add plain reporter ([3d30df9](https://github.com/gemini-testing/hermione/commit/3d30df9))



<a name="0.32.0"></a>
# [0.32.0](https://github.com/gemini-testing/hermione/compare/v0.21.0...v0.32.0) (2017-04-04)


### Features

* add plain reporter ([3d30df9](https://github.com/gemini-testing/hermione/commit/3d30df9))



<a name="0.31.0"></a>
# [0.31.0](https://github.com/gemini-testing/hermione/compare/v0.30.2...v0.31.0) (2017-04-03)


### Features

* make browser.url work like url.resolve ([727f78d](https://github.com/gemini-testing/hermione/commit/727f78d))



<a name="0.30.2"></a>
## [0.30.2](https://github.com/gemini-testing/hermione/compare/v0.30.1...v0.30.2) (2017-03-15)


### Bug Fixes

* ignore failed tests from mocha ([bd41074](https://github.com/gemini-testing/hermione/commit/bd41074))



<a name="0.30.1"></a>
## [0.30.1](https://github.com/gemini-testing/hermione/compare/v0.30.0...v0.30.1) (2017-03-15)


### Bug Fixes

* fail instead of hang on throws from event handlers ([6c1706a](https://github.com/gemini-testing/hermione/commit/6c1706a))



<a name="0.30.0"></a>
# [0.30.0](https://github.com/gemini-testing/hermione/compare/v0.28.4...v0.30.0) (2017-03-15)


### Features

* load plugins and pass events when reading files ([b402217](https://github.com/gemini-testing/hermione/commit/b402217))
* pass mocha suite on 'beforeFileRead' and 'afterFileRead' events ([3e25894](https://github.com/gemini-testing/hermione/commit/3e25894))



<a name="0.29.0"></a>
# [0.29.0](https://github.com/gemini-testing/hermione/compare/v0.21.0...v0.29.0) (2017-03-06)


### Features

* load plugins and pass events when reading files ([b402217](https://github.com/gemini-testing/hermione/commit/b402217))


<a name="0.28.4"></a>
## [0.28.4](https://github.com/gemini-testing/hermione/compare/v0.28.3...v0.28.4) (2017-03-02)


### Bug Fixes

* bug with file path on 'before all' hook ([a3ffee7](https://github.com/gemini-testing/hermione/commit/a3ffee7))



<a name="0.28.3"></a>
## [0.28.3](https://github.com/gemini-testing/hermione/compare/v0.28.2...v0.28.3) (2017-02-28)


### Bug Fixes

* the output to file path on 'before all' hook ([1378e75](https://github.com/gemini-testing/hermione/commit/1378e75))



<a name="0.28.2"></a>
## [0.28.2](https://github.com/gemini-testing/hermione/compare/v0.28.1...v0.28.2) (2017-02-23)


### Bug Fixes

* Do not save whole runnable object - decrease memory leaks ([d1c0224](https://github.com/gemini-testing/hermione/commit/d1c0224))



<a name="0.28.1"></a>
## [0.28.1](https://github.com/gemini-testing/hermione/compare/v0.28.0...v0.28.1) (2017-02-22)


### Bug Fixes

* Boolean env and cli vars reading ([fb5e932](https://github.com/gemini-testing/hermione/commit/fb5e932))



<a name="0.28.0"></a>
# [0.28.0](https://github.com/gemini-testing/hermione/compare/v0.27.0...v0.28.0) (2017-02-13)


### Features

* BEFORE_FILE_READ and AFTER_FILE_READ events ([f2a5593](https://github.com/gemini-testing/hermione/commit/f2a5593))



<a name="0.27.0"></a>
# [0.27.0](https://github.com/gemini-testing/hermione/compare/v0.25.1...v0.27.0) (2017-02-13)


### Bug Fixes

* Make sync and async events pass through separately ([87722ba](https://github.com/gemini-testing/hermione/commit/87722ba))


### Features

* Add hermione.only.notIn() helper ([17b4453](https://github.com/gemini-testing/hermione/commit/17b4453))



<a name="0.26.0"></a>
## [0.26.0](https://github.com/gemini-testing/hermione/compare/v0.25.2...v0.26.0) (2017-02-08)

### Features

* add helper hermione.only.notIn ([17b4453](https://github.com/gemini-testing/hermione/commit/17b4453))


<a name="0.25.2"></a>
## [0.25.2](https://github.com/gemini-testing/hermione/compare/v0.25.1...v0.25.2) (2017-02-07)


### Bug Fixes

* skip.only should skip only one test/suite below the record ([c13adc8](https://github.com/gemini-testing/hermione/commit/c13adc8))



<a name="0.25.1"></a>
## [0.25.1](https://github.com/gemini-testing/hermione/compare/v0.25.0...v0.25.1) (2017-01-25)


### Bug Fixes

* 'global.hermione' is not defined when reading tests via 'readTests' ([64ff66a](https://github.com/gemini-testing/hermione/commit/64ff66a))



<a name="0.25.0"></a>
# [0.25.0](https://github.com/gemini-testing/hermione/compare/v0.22.0...v0.25.0) (2017-01-25)


### Bug Fixes

* 'hermione.ctx' is not available in a callback of test ([a6fec7c](https://github.com/gemini-testing/hermione/commit/a6fec7c))
* Fix url decoration for urls without pathnames ([5df188e](https://github.com/gemini-testing/hermione/commit/5df188e))
* set meta info on before each hook ([f0ea113](https://github.com/gemini-testing/hermione/commit/f0ea113))


### Features

* add method 'hermione.ctx' to tests API ([0506da6](https://github.com/gemini-testing/hermione/commit/0506da6))



<a name="0.24.1"></a>
## [0.24.1](https://github.com/gemini-testing/hermione/compare/v0.24.0...v0.24.1) (2017-01-25)


### Bug Fixes

* 'hermione.ctx' is not available in a callback of test ([a6fec7c](https://github.com/gemini-testing/hermione/commit/a6fec7c))



<a name="0.24.0"></a>
# [0.24.0](https://github.com/gemini-testing/hermione/compare/v0.23.1...v0.24.0) (2017-01-25)


### Features

* add method 'hermione.ctx' to tests API ([0506da6](https://github.com/gemini-testing/hermione/commit/0506da6))



<a name="0.23.1"></a>
## [0.23.1](https://github.com/gemini-testing/hermione/compare/v0.23.0...v0.23.1) (2017-01-15)



<a name="0.23.0"></a>
# [0.23.0](https://github.com/gemini-testing/hermione/compare/v0.20.0...v0.23.0) (2016-12-30)


### Bug Fixes

* set meta info on before each hook ([f0ea113](https://github.com/gemini-testing/hermione/commit/f0ea113))


### Features

* add ability to specify sets in config ([b713732](https://github.com/gemini-testing/hermione/commit/b713732))
* make hermione instance available from hermione plugins ([0767d5f](https://github.com/gemini-testing/hermione/commit/0767d5f))
* remove hermione facade module ([738796b](https://github.com/gemini-testing/hermione/commit/738796b))



<a name="0.22.0"></a>
# [0.22.0](https://github.com/gemini-testing/hermione/compare/v0.15.3...v0.22.0) (2016-12-26)


### Bug Fixes

* correct resolving of baseUrl in config ([c010dc6](https://github.com/gemini-testing/hermione/commit/c010dc6))


### Features

* add ability to specify sets in config ([b713732](https://github.com/gemini-testing/hermione/commit/b713732))
* add option 'httpTimeout' ([8b747e0](https://github.com/gemini-testing/hermione/commit/8b747e0))
* add option 'sessionQuitTimeout' ([acc93f6](https://github.com/gemini-testing/hermione/commit/acc93f6))
* add option 'sessionRequestTimeout' ([a15b022](https://github.com/gemini-testing/hermione/commit/a15b022))
* add programmatic API ([248caf6](https://github.com/gemini-testing/hermione/commit/248caf6))
* make hermione instance available from hermione plugins ([0767d5f](https://github.com/gemini-testing/hermione/commit/0767d5f))
* remove hermione facade module ([738796b](https://github.com/gemini-testing/hermione/commit/738796b))



<a name="0.21.0"></a>
# [0.21.0](https://github.com/gemini-testing/hermione/compare/v0.20.0...v0.21.0) (2016-12-22)


### Features

* add ability to specify sets in config ([b713732](https://github.com/gemini-testing/hermione/commit/b713732))



<a name="0.20.0"></a>
# [0.20.0](https://github.com/gemini-testing/hermione/compare/v0.19.0...v0.20.0) (2016-12-20)


### Bug Fixes

* correct resolving of baseUrl in config ([c010dc6](https://github.com/gemini-testing/hermione/commit/c010dc6))


### Features

* add option 'sessionRequestTimeout' ([a15b022](https://github.com/gemini-testing/hermione/commit/a15b022))



# Changelog

## 0.19.0 - 2016-12-10

* feat: add API for tests reading

## 0.18.2 - 2016-12-05

* fix: `screenshotOnReject` may not be declared in config file

## 0.18.1 - 2016-12-02

* feat: add ability to configure timeout for take screenshot

## 0.18.0 - 2016-11-29

* major: Remove option `screenshotOnReject`
* feat: add option [sessionQuitTimeout](https://github.com/gemini-testing/hermione/blob/v0.18.0/README.md#sessionquittimeout)
* fix: more informative error if parsing of a config fails

## 0.17.0 - 2016-11-23

* Add programmatic API. See [doc](https://github.com/gemini-testing/hermione/blob/master/README.md#programmatic-api) for more details.

## 0.16.0 - 2016-11-17

* Add ability to run specific tests only in specific browsers without marking test as skipped in other browsers. See method [only](https://github.com/gemini-testing/hermione#only)
* Add ability to specify http timeout for requests to Selenium server

## 0.15.4 - 2016-11-16

* Fix: ability to override browser options from config

## 0.15.3 – 2016-11-11

* Added passing of browser identifier to `SESSION_START` and `SESSION_END` event handlers
* Added eslint code validation tool instead of jshint and jscs

## 0.15.2 – 2016-10-31

* Fixed bug with hermione freezing because of errors in `prepareBrowser` option in config

## 0.15.1 - 2016-10-26

* Added passing of runner instance to `RUNNER_START` event handler which allows to trigger and subscribe to any other events via this runner
* Fixed `flat` reporter which incorrectly counts statistics (`total`, `passed`, `failed` e.t.c) when several events were triggered for the same test (for example, `TEST_FAIL` after `TEST_PENDING`)

## 0.15.0 - 2016-10-10

* Throw an error if tests have the same title

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
