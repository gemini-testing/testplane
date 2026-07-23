"use strict";

const _ = require("lodash");
const Mocha = require("mocha");

const { MochaEventBus } = require("./mocha-event-bus");
const { TreeBuilderDecorator } = require("./tree-builder-decorator");
const { TestReaderEvents } = require("../../events");
const { MasterEvents } = require("../../events");
const { getMethodsByInterface } = require("./utils");
const logger = require("../../utils/logger");
const { enableSourceMaps } = require("../../utils/typescript");

function getTagParser(original) {
    return function (title, paramsOrFn, fn) {
        if (typeof paramsOrFn === "function") {
            return original.call(this, title, paramsOrFn);
        } else {
            const test = original.call(this, title, fn);

            if (paramsOrFn?.tag) {
                if (Array.isArray(paramsOrFn.tag)) {
                    test.tags = paramsOrFn.tag.map(title => ({ title, dynamic: false }));
                } else {
                    test.tags = [{ title: paramsOrFn.tag, dynamic: false }];
                }
            }

            return test;
        }
    };
}

async function readFiles(files, { esmDecorator, config, eventBus, runnableOpts, isBrowserEnv = false, fileObserver }) {
    const mocha = new Mocha(config);

    mocha.suite.on("pre-require", context => {
        const originalDescribe = context.describe;
        const originalIt = context.it;

        context.describe = getTagParser(originalDescribe);
        context.context = getTagParser(originalDescribe);

        context.describe.only = originalDescribe.only;
        context.describe.skip = originalDescribe.skip;

        context.it = getTagParser(originalIt);
        context.specify = getTagParser(originalIt);

        context.it.only = originalIt.only;
        context.it.skip = originalIt.skip;
    });

    mocha.fullTrace();

    initBuildContext(eventBus);
    initEventListeners({ rootSuite: mocha.suite, outBus: eventBus, config, runnableOpts, fileObserver });

    files.forEach(f => mocha.addFile(f));

    try {
        await mocha.loadFilesAsync({ esmDecorator });
    } catch (err) {
        const errorMessage = (err.message || "").split("\n")[0].trim();

        if (isBrowserEnv && err.code === "MODULE_NOT_FOUND" && errorMessage.includes("?")) {
            logger.warn(
                `Failed to resolve module with query parameter: ${errorMessage}. ` +
                    `This is likely a Vite-style import (e.g., './file.svg?react'). ` +
                    `Please install @babel/parser version 7 or higher to fix this issue.`,
            );
        }

        throw err;
    }

    applyOnly(mocha.suite, eventBus);
}

function initBuildContext(outBus) {
    outBus.emit(TestReaderEvents.NEW_BUILD_INSTRUCTION, ctx => {
        ctx.treeBuilder = TreeBuilderDecorator.create(ctx.treeBuilder);
    });
}

function initEventListeners({ rootSuite, outBus, config, runnableOpts, fileObserver }) {
    const inBus = MochaEventBus.create(rootSuite);

    forbidSuiteHooks(inBus);
    passthroughFileEvents(inBus, outBus, fileObserver);
    addLocationToRunnables(inBus, config, runnableOpts);
    registerTestObjects(inBus, outBus);

    inBus.emit(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, rootSuite);
}

function forbidSuiteHooks(bus) {
    [MochaEventBus.events.EVENT_SUITE_ADD_HOOK_BEFORE_ALL, MochaEventBus.events.EVENT_SUITE_ADD_HOOK_AFTER_ALL].forEach(
        event => {
            bus.on(event, () => {
                throw new Error(
                    '"before" and "after" hooks are forbidden, use "beforeEach" and "afterEach" hooks instead',
                );
            });
        },
    );
}

function passthroughFileEvents(inBus, outBus, fileObserver) {
    inBus.on(MochaEventBus.events.EVENT_FILE_PRE_REQUIRE, (ctx, file) => {
        fileObserver?.start(file);
        outBus.emit(MasterEvents.BEFORE_FILE_READ, { file });
    });
    inBus.on(MochaEventBus.events.EVENT_FILE_POST_REQUIRE, (ctx, file) => {
        outBus.emit(MasterEvents.AFTER_FILE_READ, { file });
        fileObserver?.end(file);
    });
}

function registerTestObjects(inBus, outBus) {
    [
        [MochaEventBus.events.EVENT_SUITE_ADD_SUITE, (treeBuilder, suite) => treeBuilder.addSuite(suite)],
        [MochaEventBus.events.EVENT_SUITE_ADD_TEST, (treeBuilder, test) => treeBuilder.addTest(test)],
        [
            MochaEventBus.events.EVENT_SUITE_ADD_HOOK_BEFORE_EACH,
            (treeBuilder, hook) => treeBuilder.addBeforeEachHook(hook),
        ],
        [
            MochaEventBus.events.EVENT_SUITE_ADD_HOOK_AFTER_EACH,
            (treeBuilder, hook) => treeBuilder.addAfterEachHook(hook),
        ],
    ].forEach(([event, instruction]) => {
        inBus.on(event, testObject => {
            outBus.emit(TestReaderEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) =>
                instruction(treeBuilder, testObject),
            );
        });
    });
}

function applyOnly(rootSuite, eventBus) {
    if (!rootSuite.hasOnly()) {
        return;
    }

    const titlesToRun = [];

    // filterOnly modifies mocha tree removing links between test objects from top to bottom
    // we are using links from bottom to top (i.e. parent property)
    // so it is safe to use build instructions after modifying mocha tree
    rootSuite.filterOnly();
    rootSuite.eachTest(mochaTest => titlesToRun.push(mochaTest.fullTitle()));

    eventBus.emit(TestReaderEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
        treeBuilder.addTestFilter(test => titlesToRun.includes(test.fullTitle()));
    });
}

function addLocationToRunnables(inBus, config, runnableOpts) {
    if (!runnableOpts?.saveLocations && !runnableOpts?.saveHookLocations) {
        return;
    }

    enableSourceMaps();

    const sourceMapSupport = tryToRequireSourceMapSupport();
    const {
        suiteMethods,
        testMethods,
        beforeEachMethods = [],
        afterEachMethods = [],
    } = getMethodsByInterface(config.ui);

    inBus.on(MochaEventBus.events.EVENT_FILE_PRE_REQUIRE, ctx => {
        const runnableMethods = runnableOpts.saveLocations
            ? [
                  {
                      methods: suiteMethods,
                      eventName: MochaEventBus.events.EVENT_SUITE_ADD_SUITE,
                  },
                  {
                      methods: testMethods,
                      eventName: MochaEventBus.events.EVENT_SUITE_ADD_TEST,
                  },
              ]
            : [];
        const hookMethods = runnableOpts.saveHookLocations
            ? [
                  {
                      methods: beforeEachMethods,
                      eventName: MochaEventBus.events.EVENT_SUITE_ADD_HOOK_BEFORE_EACH,
                  },
                  {
                      methods: afterEachMethods,
                      eventName: MochaEventBus.events.EVENT_SUITE_ADD_HOOK_AFTER_EACH,
                  },
              ]
            : [];

        [...runnableMethods, ...hookMethods].forEach(({ methods, eventName }) => {
            methods.forEach(methodName => {
                ctx[methodName] = withLocation(ctx[methodName], { inBus, eventName, sourceMapSupport });

                if (runnableOpts.saveLocations && ctx[methodName]) {
                    ctx[methodName].only = withLocation(ctx[methodName].only, { inBus, eventName, sourceMapSupport });
                    ctx[methodName].skip = withLocation(ctx[methodName].skip, { inBus, eventName, sourceMapSupport });
                }

                if (runnableOpts.saveLocations && (!config.ui || config.ui === "bdd")) {
                    const pendingMethodName = `x${methodName}`;
                    ctx[pendingMethodName] = withLocation(ctx[pendingMethodName], {
                        inBus,
                        eventName,
                        sourceMapSupport,
                    });
                }
            });
        });
    });
}

function withLocation(origFn, { inBus, eventName, sourceMapSupport }) {
    if (!_.isFunction(origFn)) {
        return origFn;
    }

    const wrappedFn = (...args) => {
        const origStackTraceLimit = Error.stackTraceLimit;
        const origPrepareStackTrace = Error.prepareStackTrace;

        Error.stackTraceLimit = 2;
        Error.prepareStackTrace = (error, stackFrames) => {
            const frame = sourceMapSupport ? sourceMapSupport.wrapCallSite(stackFrames[1]) : stackFrames[1];

            return {
                line: frame.getLineNumber(),
                column: frame.getColumnNumber(),
            };
        };

        const obj = {};
        Error.captureStackTrace(obj);

        const location = obj.stack;
        Error.stackTraceLimit = origStackTraceLimit;
        Error.prepareStackTrace = origPrepareStackTrace;

        inBus.once(eventName, runnable => {
            if (!runnable.location) {
                runnable.location = location;
            }
        });

        return origFn(...args);
    };

    for (const key of Object.keys(origFn)) {
        wrappedFn[key] = origFn[key];
    }

    return wrappedFn;
}

function tryToRequireSourceMapSupport() {
    try {
        const module = require("@cspotcode/source-map-support");
        module.install({ hookRequire: true });

        return module;
    } catch {} // eslint-disable-line no-empty
}

module.exports = {
    readFiles,
};
