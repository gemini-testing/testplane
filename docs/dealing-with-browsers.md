<!-- DOCTOC SKIP -->

## Dealing with Browsers

All you need are browsers that Testplane could use for testing. To do this you need to install some browsers, such as [chrome](https://www.google.com/chrome/) (to automate this process you can use the [@testplane/headless-chrome](https://github.com/gemini-testing/testplane-headless-chrome) plugin).

Next, you have two ways to configure Testplane to work with browsers:

* Using the devtools protocol (available only for `Chromium`-based browsers). This method does not need to be pre-configured. Just go to the [quick start](#quick-start).
* Using the webdriver protocol. In this case you need to set up [Selenium](http://www.seleniumhq.org/) grid. The simplest way to get started is to use one of the NPM selenium standalone packages, such as [vvo/selenium-standalone](https://github.com/vvo/selenium-standalone). For more information about setting up, see [selenium-standalone](#selenium-standalone).

### Selenium-standalone
Install `selenium-standalone` by command:

```
npm i -g selenium-standalone
```

Next you need to install browser drivers

```
selenium-standalone install
```

and run your server by executing

```
selenium-standalone start
```

:warning: If you will get error like `No Java runtime present, requesting install.` you should install [Java Development Kit (JDK)](https://www.oracle.com/technetwork/java/javase/downloads/index.html) for your OS.
