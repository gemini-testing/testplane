### Testing android apps

A project with examples of using integration testing in android applications (web, native and hybrid).

#### Usage

1. [Install Android Studio](https://developer.android.com/studio?hl=ru)

2. [Create android virtual device](https://developer.android.com/studio/run/managing-avds) with API level 35 and run it

3. Use Node.JS version specified in `.nvmrc`:

```shell
nvm use
```

4. Install dependencies:

```shell
npm ci
```

5. Install [UiAutomator2 Driver](https://github.com/appium/appium-uiautomator2-driver) for [appium](https://appium.io):

```shell
./node_modules/.bin/appium driver install uiautomator2
```

6. Run Appium in separate terminal tab:

```shell
npx appium -p 4444 --relaxed-security
```

7. Run Testplane tests:

```shell
npx testplane
```

---

For more information on how to automate testing in android applications can be found in [this guide](https://testplane.io/docs/v8/guides/android-testing/).
