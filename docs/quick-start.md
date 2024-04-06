<!-- DOCTOC SKIP -->
## Quick start

First of all, make sure you are working via `devtools` protocol or have browsers installed as described in [Dealing with Browsers](https://github.com/gemini-testing/hermione/blob/master/docs/dealing-with-browsers.md).

Now you have two ways to configure project.

### Using npm init Testplane (a quick way)

You just need to run the cli command from [create-testplane](https://github.com/gemini-testing/create-testplane) tool and answer a few questions:
```
npm init testplane YOUR_PROJECT_PATH
```

To skip all questions just add the option `-y` at the end.

### Configuring .testplane.conf.js by yourself (a slow way)

Create Testplane config file with name `.testplane.conf.js` in the project root. There are two configuration options depending on the method selected in the `prerequisites` section.

#### Chrome Devtools Protocol

```javascript
module.exports = {
    sets: {
        desktop: {
            files: 'tests/desktop/**/*.testplane.js'
        }
    },

    browsers: {
        chrome: {
            automationProtocol: 'devtools',
            desiredCapabilities: {
                browserName: 'chrome'
            }
        }
    }
};
```

#### Webdriver protocol

```javascript
module.exports = {
    gridUrl: 'http://localhost:4444/wd/hub',

    sets: {
        desktop: {
            files: 'tests/desktop/*.testplane.js'
        }
    },

    browsers: {
        chrome: {
            automationProtocol: 'webdriver', // default value
            desiredCapabilities: {
                browserName: 'chrome'
            }
        }
    }
};
```

Write your first test in `tests/desktop/github.testplane.js` file.
```javascript
describe('github', function() {
    it('should check repository name', async ({ browser }) => {
        await browser.url('https://github.com/gemini-testing/testplane');

        await expect(browser.$('#readme h1')).toHaveText('Testplane (ex-Hermione)');
    });
});
```

Finally, run tests (be sure that you have already run `selenium-standalone start` command in next tab).
```
node_modules/.bin/testplane
```
