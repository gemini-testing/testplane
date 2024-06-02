# BEFORE_FILE_READ {#before-file-read}

**sync | master | worker**

The `BEFORE_FILE_READ` event is triggered before the test file is read to parse it. The event handler is executed synchronously. The event is also available in Testplane workers.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.BEFORE_FILE_READ, ({ file, testplane, testParser }) => {
    testParser.setController('<some-command-name>', {
        '<some-helper>': function(matcher) {
        // ...
        }
    });
});
```

### Handler parameters {#handler-parameters}

An object of the following format is passed to the event handler:

```javascript
{
    file, // String: path to the file with the test
    testplane, // Object: same as global.testplane
    testParser // Object: type TestParserAPI
}
```

### testParser: TestParserAPI {#test_parser}

The `testParser` object of type `TestParserAPI` is passed to the `BEFORE_FILE_READ` event handler. With its help, you can control the process of parsing files with tests. The object supports the `setController` method, with which you can create your own helpers for tests.

**setController(name, methods)**

The method adds a controller to the global `testplane` object, available inside tests.

* `name` is the name of the helper (or otherwise, the controller);
* `methods` is a dictionary object whose keys specify the names of the methods of the corresponding helpers, and the values ​​of the keys determine their implementation. Each method will be called on the corresponding test or test suite _(suite)_.

{% note info %}

The controller will be deleted as soon as the parsing of the current file is finished.

{% endnote %}

## Usage {#usage}

As an example, let's create a special helper `testplane.logger.log()`, with which we can log information about the parsing of the test we are interested in.

**Plugin code**

```javascript
testplane.on(testplane.events.BEFORE_FILE_READ, ({ file, testParser }) => {
    testParser.setController('logger', {
        log: function(prefix) {
            console.log(`${prefix}: just parsed ${this.fullTitle()} from ${file} for browser ${this.browserId}`);
        }
    });
});
```

**Test code**

```javascript
describe('foo', () => {
    testplane.logger.log('some-prefix');

    it('bar', function() {
        // ...
    });
});
```


Another example of using the `BEFORE_FILE_READ` event can be found in the section "[Running tests with helpers](./usage-examples/running-tests-with-helpers.md)".