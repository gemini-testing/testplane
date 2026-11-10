"use strict";

const { resolve } = require("node:path");
const { Config } = require("src/config");
const { TestParser } = require("src/test-reader/test-parser");
const { MasterEvents } = require("src/events");

describe("file-scoped directives", () => {
    const fixture = name => resolve(__dirname, "../../fixtures/test-reader/file-directives", name);
    const firstFile = fixture("dangling.js");
    const secondFile = fixture("second.js");
    const emptyFile = fixture("empty.js");
    const globalNames = [
        "testplane",
        "hermione",
        "describe",
        "context",
        "xdescribe",
        "xcontext",
        "it",
        "specify",
        "xit",
        "xspecify",
        "before",
        "after",
        "beforeEach",
        "afterEach",
        "run",
    ];
    let originalGlobals;

    const declarations = {
        "skip.in": () => global.testplane.skip.in("chrome", "Reason from the first file"),
        "skip.notIn": () => global.testplane.skip.notIn("firefox", "Reason from the first file"),
        "skip.in with silent": () =>
            global.testplane.skip.in("chrome", "Reason from the first file", {
                silent: true,
            }),
        "only.in": () => global.testplane.only.in("firefox"),
        "only.notIn": () => global.testplane.only.notIn("chrome"),
        "also.in": () => global.testplane.also.in("chrome"),
        "config.testTimeout": () => global.testplane.config.testTimeout(12345),
        "browser.version": () => global.testplane.browser("chrome").version("999"),
        "plugin controller": () => global.testplane.custom.mark(),
    };

    beforeEach(() => {
        originalGlobals = globalNames.map(name => [name, Object.getOwnPropertyDescriptor(global, name)]);
    });

    afterEach(() => {
        originalGlobals.forEach(([name, descriptor]) => {
            if (descriptor) {
                Object.defineProperty(global, name, descriptor);
            } else {
                delete global[name];
            }
        });
    });

    const load = async (files, declareDirective = () => {}) => {
        const config = await Config.create({
            browsers: {
                chrome: {
                    desiredCapabilities: {
                        browserName: "chrome",
                        browserVersion: "123",
                    },
                    testTimeout: 4567,
                },
                firefox: {
                    desiredCapabilities: {
                        browserName: "firefox",
                    },
                },
            },
            system: {
                ctx: {
                    declareDirective,
                },
            },
        });
        const parser = new TestParser();

        parser.on(MasterEvents.BEFORE_FILE_READ, ({ testParser }) => {
            testParser.setController("custom", {
                mark() {
                    this.timeout = 12345;
                },
            });
        });
        await parser.loadFiles(files, {
            config,
        });

        return () =>
            parser.parse(files, {
                browserId: "chrome",
                config: config.forBrowser("chrome"),
            });
    };

    Object.entries(declarations).forEach(([name, declareDirective]) => {
        it(`should report an unused ${name} directive in its source file`, async () => {
            const parse = await load([firstFile, secondFile], declareDirective);

            assert.throws(parse, Error, `Unused test directives in file "${firstFile}"`);
        });
    });

    it("should validate unused directives in the last file", async () => {
        const parse = await load([secondFile, firstFile], declarations["skip.in"]);

        assert.throws(parse, Error, `Unused test directives in file "${firstFile}"`);
    });

    it("should apply a directive to the following test without affecting the next file", async () => {
        const parse = await load([fixture("valid.js"), secondFile], declarations["skip.in"]);
        const tests = parse();

        assert.isTrue(tests[0].pending);
        assert.equal(tests[0].skipReason, "Reason from the first file");
        assert.isFalse(tests[1].pending);
    });

    it("should apply a directive to the following suite in the same file", async () => {
        const parse = await load([fixture("suite.js"), secondFile], declarations["skip.in"]);
        const tests = parse();

        assert.isTrue(tests[0].pending);
        assert.isFalse(tests[1].pending);
    });

    it("should preserve global browser and timeout settings across empty files", async () => {
        const parse = await load([emptyFile, secondFile, emptyFile]);
        const tests = parse();

        assert.lengthOf(tests, 1);
        assert.equal(tests[0].browserId, "chrome");
        assert.equal(tests[0].browserVersion, "123");
        assert.equal(tests[0].timeout, 4567);
    });
});
