# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="0.75.0"></a>
# [0.75.0](https://github.com/gemini-testing/hermione/compare/v0.74.0...v0.75.0) (2018-06-29)


### Features

* add 'screenshotDelay' option ([ced8e9f](https://github.com/gemini-testing/hermione/commit/ced8e9f))



<a name="0.74.0"></a>
# [0.74.0](https://github.com/gemini-testing/hermione/compare/v0.73.0...v0.74.0) (2018-06-26)


### Features

* ability to iterate over all root suites in test collection ([bc02934](https://github.com/gemini-testing/hermione/commit/bc02934))



<a name="0.73.0"></a>
# [0.73.0](https://github.com/gemini-testing/hermione/compare/v0.72.0...v0.73.0) (2018-06-26)


### Bug Fixes

* TestCollection: do not add empty browser to properties ([63bdc77](https://github.com/gemini-testing/hermione/commit/63bdc77))


### Features

* AFTER_TESTS_READ event ([45c4acb](https://github.com/gemini-testing/hermione/commit/45c4acb))



<a name="0.72.0"></a>
# [0.72.0](https://github.com/gemini-testing/hermione/compare/v0.71.0...v0.72.0) (2018-06-25)


### Bug Fixes

* add backwards compatibility for hermione.readTests ([c19235f](https://github.com/gemini-testing/hermione/commit/c19235f))
* passthrough "pixelRatio" to image comparator ([6775838](https://github.com/gemini-testing/hermione/commit/6775838))


### Features

* ability to enable/disable tests in TestCollection ([cac56f7](https://github.com/gemini-testing/hermione/commit/cac56f7))
* ability to pass TestCollection to run method ([6e8582b](https://github.com/gemini-testing/hermione/commit/6e8582b))
* own test runner instead of mocha for master process ([667ca48](https://github.com/gemini-testing/hermione/commit/667ca48))
* parse tests before runner start ([67a5ac7](https://github.com/gemini-testing/hermione/commit/67a5ac7))
* SuiteCollection.eachTest method ([0871b7d](https://github.com/gemini-testing/hermione/commit/0871b7d))



<a name="0.71.0"></a>
# [0.71.0](https://github.com/gemini-testing/hermione/compare/v0.70.0...v0.71.0) (2018-06-08)


### Features

* do not retry test failed with no ref image error ([2055f4e](https://github.com/gemini-testing/hermione/commit/2055f4e))



<a name="0.70.0"></a>
# [0.70.0](https://github.com/gemini-testing/hermione/compare/v0.68.0...v0.70.0) (2018-06-04)


### Bug Fixes

* handle cases when error does not have 'hermioneCtx' ([5a82074](https://github.com/gemini-testing/hermione/commit/5a82074))


### Features

* add ability to exlude paths in 'readTests' ([724c7b4](https://github.com/gemini-testing/hermione/commit/724c7b4))



<a name="0.69.0"></a>
# [0.69.0](https://github.com/gemini-testing/hermione/compare/v0.68.0...v0.69.0) (2018-05-17)


### Features

* add ability to exlude paths in 'readTests' ([724c7b4](https://github.com/gemini-testing/hermione/commit/724c7b4))



<a name="0.68.0"></a>
# [0.68.0](https://github.com/gemini-testing/hermione/compare/v0.67.0...v0.68.0) (2018-05-17)


### Features

* do not fail on first 'assertView' error ([3bd61d4](https://github.com/gemini-testing/hermione/commit/3bd61d4))



<a name="0.67.0"></a>
# [0.67.0](https://github.com/gemini-testing/hermione/compare/v0.66.1...v0.67.0) (2018-05-07)


### Features

* introduce hermione.halt method ([ac028fe](https://github.com/gemini-testing/hermione/commit/ac028fe))



<a name="0.66.1"></a>
## [0.66.1](https://github.com/gemini-testing/hermione/compare/v0.66.0...v0.66.1) (2018-04-26)


### Bug Fixes

* config property "shouldRetry" now works correctly ([2645612](https://github.com/gemini-testing/hermione/commit/2645612))



<a name="0.66.0"></a>
# [0.66.0](https://github.com/gemini-testing/hermione/compare/v0.65.2...v0.66.0) (2018-04-10)


### Features

* return all meta on getMeta call without arguments ([79264e2](https://github.com/gemini-testing/hermione/commit/79264e2))



<a name="0.65.2"></a>
## [0.65.2](https://github.com/gemini-testing/hermione/compare/v0.65.1...v0.65.2) (2018-03-19)



<a name="0.65.1"></a>
## [0.65.1](https://github.com/gemini-testing/hermione/compare/v0.65.0...v0.65.1) (2018-03-16)


### Bug Fixes

* sync config in worker before running tests ([ba68fea](https://github.com/gemini-testing/hermione/commit/ba68fea))



<a name="0.65.0"></a>
# [0.65.0](https://github.com/gemini-testing/hermione/compare/v0.64.0...v0.65.0) (2018-03-15)


### Features

* add 'hermioneCtx' field to the test after reading the file ([f94c91c](https://github.com/gemini-testing/hermione/commit/f94c91c))
* emit 'INIT' event for each worker ([f9f7f54](https://github.com/gemini-testing/hermione/commit/f9f7f54))



<a name="0.64.0"></a>
# [0.64.0](https://github.com/gemini-testing/hermione/compare/v0.63.0...v0.64.0) (2018-03-15)


### Features

* add 'ignoreElements' options to 'assertView' command ([bd10710](https://github.com/gemini-testing/hermione/commit/bd10710))
* option 'compositeImage' for 'assertView' command ([610df5e](https://github.com/gemini-testing/hermione/commit/610df5e))
* option 'screenshotMode' ([35dd71e](https://github.com/gemini-testing/hermione/commit/35dd71e))
* wrap tests running in command ([fcbd8bf](https://github.com/gemini-testing/hermione/commit/fcbd8bf))



<a name="0.63.0"></a>
# [0.63.0](https://github.com/gemini-testing/hermione/compare/v0.62.0...v0.63.0) (2018-03-02)


### Bug Fixes

* optional timeouts by default does not equal to httpTimeout ([aa670d9](https://github.com/gemini-testing/hermione/commit/aa670d9))


### Features

* assert view by selectors ([b090a5f](https://github.com/gemini-testing/hermione/commit/b090a5f))
* do not use webdriverio screenshotOnReject option ([326a8d0](https://github.com/gemini-testing/hermione/commit/326a8d0))
* drop node versions previous to 8 ([5136865](https://github.com/gemini-testing/hermione/commit/5136865))
* take screenshot on test or hook fail ([ec47808](https://github.com/gemini-testing/hermione/commit/ec47808))



<a name="0.62.0"></a>
# [0.62.0](https://github.com/gemini-testing/hermione/compare/v0.61.0...v0.62.0) (2018-02-20)


### Features

* add screenshotOnReject and screenshotOnRejectTimeout options ([236efaf](https://github.com/gemini-testing/hermione/commit/236efaf))



<a name="0.61.0"></a>
# [0.61.0](https://github.com/gemini-testing/hermione/compare/v0.60.0...v0.61.0) (2018-02-14)


### Features

* introduce shouldRerty config option ([pull/224](https://github.com/gemini-testing/hermione/pull/224))

<a name="0.60.1"></a>
## [0.60.1](https://github.com/gemini-testing/hermione/compare/v0.60.0...v0.60.1) (2018-02-09)


### Bug Fixes

* do not store all mocha instances in workers ([ed7aab4](https://github.com/gemini-testing/hermione/commit/ed7aab4))
* drop webdriverio command history after each test in workers ([51c4daf](https://github.com/gemini-testing/hermione/commit/51c4daf))



<a name="0.60.0"></a>
# [0.60.0](https://github.com/gemini-testing/hermione/compare/v0.59.0...v0.60.0) (2018-02-08)


### Features

* ability to restart workers after some number of tests ([4a42b0d](https://github.com/gemini-testing/hermione/commit/4a42b0d))



<a name="0.59.0"></a>
# [0.59.0](https://github.com/gemini-testing/hermione/compare/v0.58.1...v0.59.0) (2018-02-08)


### Features

* ability to restart workers on crash ([e7e08c2](https://github.com/gemini-testing/hermione/commit/e7e08c2))



<a name="0.58.1"></a>
## [0.58.1](https://github.com/gemini-testing/hermione/compare/v0.58.0...v0.58.1) (2018-02-07)


### Bug Fixes

* browser calibration ([2391a28](https://github.com/gemini-testing/hermione/commit/2391a28))
* do not retry worker init on fail ([28352cd](https://github.com/gemini-testing/hermione/commit/28352cd))



<a name="0.58.0"></a>
# [0.58.0](https://github.com/gemini-testing/hermione/compare/v0.57.0...v0.58.0) (2018-02-04)


### Features

* **stats:** emit test statistics on RUNNER_END ([320da47](https://github.com/gemini-testing/hermione/commit/320da47))



<a name="0.57.0"></a>
# [0.57.0](https://github.com/gemini-testing/hermione/compare/v0.56.2...v0.57.0) (2018-02-04)


### Bug Fixes

* init temp in master process ([5dd0dee](https://github.com/gemini-testing/hermione/commit/5dd0dee))


### Features

* option '--update-refs' for 'assertView' command ([186ca73](https://github.com/gemini-testing/hermione/commit/186ca73))



<a name="0.56.2"></a>
## [0.56.2](https://github.com/gemini-testing/hermione/compare/v0.56.1...v0.56.2) (2018-01-30)


### Bug Fixes

* init save diff function in master process ([c263d87](https://github.com/gemini-testing/hermione/commit/c263d87))



<a name="0.56.1"></a>
## [0.56.1](https://github.com/gemini-testing/hermione/compare/v0.56.0...v0.56.1) (2018-01-27)


### Bug Fixes

* afterEach hook error overwrites original test error ([d29f549](https://github.com/gemini-testing/hermione/commit/d29f549))



<a name="0.56.0"></a>
# [0.56.0](https://github.com/gemini-testing/hermione/compare/v0.55.0...v0.56.0) (2018-01-17)


### Bug Fixes

* do not overwrite system.mochaOpts.grep property in workers ([8dce8ad](https://github.com/gemini-testing/hermione/commit/8dce8ad))


### Features

* use new glob-extra version ([2e7509f](https://github.com/gemini-testing/hermione/commit/2e7509f))



<a name="0.55.0"></a>
# [0.55.0](https://github.com/gemini-testing/hermione/compare/v0.54.3...v0.55.0) (2018-01-12)


### Bug Fixes

* update webdriverio fork to 4.9.11 ([2f0b1fc](https://github.com/gemini-testing/hermione/commit/2f0b1fc))


### Features

* add ability to calibrate image before capturing ([c80f6f0](https://github.com/gemini-testing/hermione/commit/c80f6f0))
* add assertView command ([49427cc](https://github.com/gemini-testing/hermione/commit/49427cc))



<a name="0.54.3"></a>
## [0.54.3](https://github.com/gemini-testing/hermione/compare/v0.54.2...v0.54.3) (2017-12-08)


### Bug Fixes

* set id method even for skipped suites by mocha ([ce7bc89](https://github.com/gemini-testing/hermione/commit/ce7bc89))



<a name="0.54.2"></a>
## [0.54.2](https://github.com/gemini-testing/hermione/compare/v0.54.1...v0.54.2) (2017-12-07)


### Bug Fixes

* stop emitting suite end after each test ([e78eed7](https://github.com/gemini-testing/hermione/commit/e78eed7))



<a name="0.54.1"></a>
## [0.54.1](https://github.com/gemini-testing/hermione/compare/v0.54.0...v0.54.1) (2017-12-07)


### Bug Fixes

* allow unknown options before parsing config file ([b79ad34](https://github.com/gemini-testing/hermione/commit/b79ad34))



<a name="0.54.0"></a>
# [0.54.0](https://github.com/gemini-testing/hermione/compare/v0.53.0...v0.54.0) (2017-12-07)


### Features

* allow to extend cli parser via CLI event ([6d5f96a](https://github.com/gemini-testing/hermione/commit/6d5f96a))



<a name="0.53.0"></a>
# [0.53.0](https://github.com/gemini-testing/hermione/compare/v0.52.1...v0.53.0) (2017-12-01)


### Features

* load plugins synchronously in constructor, add async INIT event ([128681a](https://github.com/gemini-testing/hermione/commit/128681a))



<a name="0.52.1"></a>
## [0.52.1](https://github.com/gemini-testing/hermione/compare/v0.52.0...v0.52.1) (2017-11-22)



<a name="0.52.0"></a>
# [0.52.0](https://github.com/gemini-testing/hermione/compare/v0.51.0...v0.52.0) (2017-11-10)


### Features

* add hermione.init method ([#196](https://github.com/gemini-testing/hermione/issues/196)) ([d532886](https://github.com/gemini-testing/hermione/commit/d532886))



<a name="0.51.0"></a>
# [0.51.0](https://github.com/gemini-testing/hermione/compare/v0.50.3...v0.51.0) (2017-11-01)


### Features

* wait for plugins load ([6499b2c](https://github.com/gemini-testing/hermione/commit/6499b2c))



<a name="0.50.3"></a>
## [0.50.3](https://github.com/gemini-testing/hermione/compare/v0.50.2...v0.50.3) (2017-10-31)



<a name="0.50.2"></a>
## [0.50.2](https://github.com/gemini-testing/hermione/compare/v0.50.1...v0.50.2) (2017-10-19)


### Bug Fixes

* **mocha-adapter:** restore browser at each mocha reinitialization ([44bc801](https://github.com/gemini-testing/hermione/commit/44bc801))
* **proxy-reporter:** rewrite on ES6 ([69ffefe](https://github.com/gemini-testing/hermione/commit/69ffefe))



<a name="0.50.1"></a>
## [0.50.1](https://github.com/gemini-testing/hermione/compare/v0.50.0...v0.50.1) (2017-10-19)



<a name="0.50.0"></a>
# [0.50.0](https://github.com/gemini-testing/hermione/compare/v0.46.0...v0.50.0) (2017-10-17)


### Bug Fixes

* Fix session rejection logic ([6393c6e](https://github.com/gemini-testing/hermione/commit/6393c6e))


<a name="0.49.0"></a>
# [0.49.0](https://github.com/gemini-testing/hermione/compare/v0.48.1...v0.49.0) (2017-10-05)


### Features

* add common data transfer between main process and subprocess ([88011c4](https://github.com/gemini-testing/hermione/commit/88011c4))



<a name="0.48.1"></a>
## [0.48.1](https://github.com/gemini-testing/hermione/compare/v0.48.0...v0.48.1) (2017-09-29)


### Bug Fixes

* update webdriver.io fork with keep-alive fix ([8926d5d](https://github.com/gemini-testing/hermione/commit/8926d5d))



<a name="0.48.0"></a>
# [0.48.0](https://github.com/gemini-testing/hermione/compare/v0.47.0...v0.48.0) (2017-09-20)


### Features

* add windowSize option ([a71ea86](https://github.com/gemini-testing/hermione/commit/a71ea86))



<a name="0.47.0"></a>
# [0.47.0](https://github.com/gemini-testing/hermione/compare/v0.46.0...v0.47.0) (2017-09-19)


### Features

* add method 'isWorker' to the API ([0698611](https://github.com/gemini-testing/hermione/commit/0698611))



<a name="0.46.0"></a>
# [0.46.0](https://github.com/gemini-testing/hermione/compare/v0.45.1...v0.46.0) (2017-09-15)


### Features

* forbid using of 'before' and 'after' hooks in tests ([0d76164](https://github.com/gemini-testing/hermione/commit/0d76164))



<a name="0.45.1"></a>
## [0.45.1](https://github.com/gemini-testing/hermione/compare/v0.45.0...v0.45.1) (2017-09-13)


### Bug Fixes

* update package-lock.json ([7e7dee0](https://github.com/gemini-testing/hermione/commit/7e7dee0))



<a name="0.45.0"></a>
# [0.45.0](https://github.com/gemini-testing/hermione/compare/v0.44.0...v0.45.0) (2017-09-13)


### Bug Fixes

* fix up opera in webdriverio fork ([5f49845](https://github.com/gemini-testing/hermione/commit/5f49845))


### Features

* **node-support:** drop of support node below 6.4.0 ([dae8e6c](https://github.com/gemini-testing/hermione/commit/dae8e6c))


### BREAKING CHANGES

* **node-support:** support only node>=6.4.0



<a name="0.44.0"></a>
# [0.44.0](https://github.com/gemini-testing/hermione/compare/v0.37.4...v0.44.0) (2017-09-10)


### Features

* extend test error with original selenium error ([500d30c](https://github.com/gemini-testing/hermione/commit/500d30c))



<a name="0.43.8"></a>
## [0.43.8](https://github.com/gemini-testing/hermione/compare/v0.43.7...v0.43.8) (2017-09-08)


### Bug Fixes

* running of tests with option 'grep' fails with exception ([4c80583](https://github.com/gemini-testing/hermione/commit/4c80583))



<a name="0.43.7"></a>
## [0.43.7](https://github.com/gemini-testing/hermione/compare/v0.43.6...v0.43.7) (2017-08-29)


### Bug Fixes

* do not hang on errors in config.prepareBrowser ([643a344](https://github.com/gemini-testing/hermione/commit/643a344))



<a name="0.43.6"></a>
## [0.43.6](https://github.com/gemini-testing/hermione/compare/v0.43.5...v0.43.6) (2017-08-25)


### Bug Fixes

* specify the release branch of forked 'worker-farm' ([649cec6](https://github.com/gemini-testing/hermione/commit/649cec6))



<a name="0.43.5"></a>
## [0.43.5](https://github.com/gemini-testing/hermione/compare/v0.43.4...v0.43.5) (2017-08-18)


### Bug Fixes

* correct passing of errors from subprocesses to the main process ([13e4c17](https://github.com/gemini-testing/hermione/commit/13e4c17))



<a name="0.43.4"></a>
## [0.43.4](https://github.com/gemini-testing/hermione/compare/v0.43.3...v0.43.4) (2017-08-17)


### Bug Fixes

* pass meta info from workers to the main process ([0e8580a](https://github.com/gemini-testing/hermione/commit/0e8580a))



<a name="0.43.3"></a>
## [0.43.3](https://github.com/gemini-testing/hermione/compare/v0.43.2...v0.43.3) (2017-08-16)


### Bug Fixes

* do not restore existing 'global.hermione' variable ([e046226](https://github.com/gemini-testing/hermione/commit/e046226))



<a name="0.43.2"></a>
## [0.43.2](https://github.com/gemini-testing/hermione/compare/v0.43.1...v0.43.2) (2017-08-15)


### Bug Fixes

* correct passing of 'screenshotOnReject' option in subprocesses ([8faae64](https://github.com/gemini-testing/hermione/commit/8faae64))



<a name="0.43.1"></a>
## [0.43.1](https://github.com/gemini-testing/hermione/compare/v0.43.0...v0.43.1) (2017-08-15)


### Bug Fixes

* do not start browsers for skipped suites ([c3d6bb1](https://github.com/gemini-testing/hermione/commit/c3d6bb1))



<a name="0.43.0"></a>
# [0.43.0](https://github.com/gemini-testing/hermione/compare/v0.42.0...v0.43.0) (2017-08-15)


### Features

* running of tests in subprocesses ([fbb51f6](https://github.com/gemini-testing/hermione/commit/fbb51f6))



<a name="0.42.0"></a>
# [0.42.0](https://github.com/gemini-testing/hermione/compare/v0.41.0...v0.42.0) (2017-08-08)


### Features

* extend browser config with its id ([06e85f6](https://github.com/gemini-testing/hermione/commit/06e85f6))
* NEW_BROWSER event ([480401a](https://github.com/gemini-testing/hermione/commit/480401a))



<a name="0.41.0"></a>
# [0.41.0](https://github.com/gemini-testing/hermione/compare/v0.40.0...v0.41.0) (2017-08-01)


### Features

* update lodash version to 4.x ([68500a0](https://github.com/gemini-testing/hermione/commit/68500a0))



<a name="0.40.0"></a>
# [0.40.0](https://github.com/gemini-testing/hermione/compare/v0.39.1...v0.40.0) (2017-08-01)


### Features

* add method 'isFailed' to the API ([5852b13](https://github.com/gemini-testing/hermione/commit/5852b13))
* add options 'loadPlugins' to the API method 'readTests' ([7a68f0a](https://github.com/gemini-testing/hermione/commit/7a68f0a))



<a name="0.39.1"></a>
## [0.39.1](https://github.com/gemini-testing/hermione/compare/v0.39.0...v0.39.1) (2017-07-25)


### Bug Fixes

* load plugins early ([5c00a24](https://github.com/gemini-testing/hermione/commit/5c00a24))



<a name="0.39.0"></a>
# [0.39.0](https://github.com/gemini-testing/hermione/compare/v0.37.4...v0.39.0) (2017-07-04)


### Features

* provide the ability to modify retries count from plugins ([fc1a372](https://github.com/gemini-testing/hermione/commit/fc1a372))



<a name="0.38.0"></a>
# [0.38.0](https://github.com/gemini-testing/hermione/compare/v0.21.0...v0.38.0) (2017-07-02)


### Features

* reject session if error matches on patterns from config ([775e0ea](https://github.com/gemini-testing/hermione/commit/775e0ea))



<a name="0.37.4"></a>
## [0.37.4](https://github.com/gemini-testing/hermione/compare/v0.37.3...v0.37.4) (2017-06-23)


### Bug Fixes

* 'hermione.only.in' functionality ([6f575c8](https://github.com/gemini-testing/hermione/commit/6f575c8))



<a name="0.37.3"></a>
## [0.37.3](https://github.com/gemini-testing/hermione/compare/v0.37.2...v0.37.3) (2017-06-20)


### Bug Fixes

* ignore memory leaks warnings for mocha suites ([93ed298](https://github.com/gemini-testing/hermione/commit/93ed298))



<a name="0.37.2"></a>
## [0.37.2](https://github.com/gemini-testing/hermione/compare/v0.37.1...v0.37.2) (2017-06-19)


### Bug Fixes

* Replace mocha timeouts with promise timeouts ([9d648d9](https://github.com/gemini-testing/hermione/commit/9d648d9))



<a name="0.37.1"></a>
## [0.37.1](https://github.com/gemini-testing/hermione/compare/v0.37.0...v0.37.1) (2017-06-14)


### Bug Fixes

* do not run 'before' and 'after' hooks for a skipped suite ([2da0467](https://github.com/gemini-testing/hermione/commit/2da0467))



<a name="0.37.0"></a>
# [0.37.0](https://github.com/gemini-testing/hermione/compare/v0.36.0...v0.37.0) (2017-06-08)


### Major

* `before` hook is similar in meaning to `beforeEach` one while running tests

### Features

* implement 'testsPerSession' option ([a5f817e](https://github.com/gemini-testing/hermione/commit/a5f817e))



<a name="0.36.0"></a>
# [0.36.0](https://github.com/gemini-testing/hermione/compare/v0.35.1...v0.36.0) (2017-05-04)


### Bug Fixes

* do not pass browser to retried tests ([b2cb7cc](https://github.com/gemini-testing/hermione/commit/b2cb7cc))


### Features

* emit BEGIN event between runners initialize and tests execution ([6e3f56b](https://github.com/gemini-testing/hermione/commit/6e3f56b))



<a name="0.35.1"></a>
## [0.35.1](https://github.com/gemini-testing/hermione/compare/v0.35.0...v0.35.1) (2017-05-02)


### Bug Fixes

* handle 'before*' hooks failure correctly ([a0934ba](https://github.com/gemini-testing/hermione/commit/a0934ba))



<a name="0.35.0"></a>
# [0.35.0](https://github.com/gemini-testing/hermione/compare/v0.34.0...v0.35.0) (2017-04-25)


### Features

* remove handling of 'before*'-hooks failure in tests ([0c74de2](https://github.com/gemini-testing/hermione/commit/0c74de2))
* improve the algorithm of retries ([b2d91b7](https://github.com/gemini-testing/hermione/commit/b2d91b7))



<a name="0.34.0"></a>
# [0.34.0](https://github.com/gemini-testing/hermione/compare/v0.33.0...v0.34.0) (2017-04-22)


### Bug Fixes

* add correct error handling in before and beforeEach hooks ([561342a](https://github.com/gemini-testing/hermione/commit/561342a))



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
