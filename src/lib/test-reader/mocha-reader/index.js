"use strict";

const { MochaEventBus } = require("./mocha-event-bus");
const { TreeBuilderDecorator } = require("./tree-builder-decorator");
const ReadEvents = require("../read-events");
const RunnerEvents = require("../../constants/runner-events");
const Mocha = require("@gemini-testing/mocha");

async function readFiles(files, { esmDecorator, config, eventBus }) {
    const mocha = new Mocha(config);
    mocha.fullTrace();

    initBuildContext(eventBus);
    initEventListeners(mocha.suite, eventBus);

    files.forEach((f) => mocha.addFile(f));
    await mocha.loadFilesAsync(esmDecorator);

    applyOnly(mocha.suite, eventBus);
}

function initBuildContext(outBus) {
    outBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, (ctx) => {
        ctx.treeBuilder = TreeBuilderDecorator.create(ctx.treeBuilder);
    });
}

function initEventListeners(rootSuite, outBus) {
    const inBus = MochaEventBus.create(rootSuite);

    forbidSuiteHooks(inBus);
    passthroughFileEvents(inBus, outBus);
    registerTestObjects(inBus, outBus);

    inBus.emit(MochaEventBus.events.EVENT_SUITE_ADD_SUITE, rootSuite);
}

function forbidSuiteHooks(bus) {
    [
        MochaEventBus.events.EVENT_SUITE_ADD_HOOK_BEFORE_ALL,
        MochaEventBus.events.EVENT_SUITE_ADD_HOOK_AFTER_ALL,
    ].forEach((event) => {
        bus.on(event, () => {
            throw new Error('"before" and "after" hooks are forbidden, use "beforeEach" and "afterEach" hooks instead');
        });
    });
}

function passthroughFileEvents(inBus, outBus) {
    [
        [MochaEventBus.events.EVENT_FILE_PRE_REQUIRE, RunnerEvents.BEFORE_FILE_READ],
        [MochaEventBus.events.EVENT_FILE_POST_REQUIRE, RunnerEvents.AFTER_FILE_READ],
    ].forEach(([mochaEvent, ourEvent]) => {
        inBus.on(mochaEvent, (ctx, file) => outBus.emit(ourEvent, { file }));
    });
}

function registerTestObjects(inBus, outBus) {
    [
        [MochaEventBus.events.EVENT_SUITE_ADD_SUITE, (treeBuilder, suite) => treeBuilder.addSuite(suite)],
        [MochaEventBus.events.EVENT_SUITE_ADD_TEST, (treeBuilder, test) => treeBuilder.addTest(test)],
        [MochaEventBus.events.EVENT_SUITE_ADD_HOOK_BEFORE_EACH, (treeBuilder, hook) => treeBuilder.addBeforeEachHook(hook)],
        [MochaEventBus.events.EVENT_SUITE_ADD_HOOK_AFTER_EACH, (treeBuilder, hook) => treeBuilder.addAfterEachHook(hook)],
    ].forEach(([event, instruction]) => {
        inBus.on(event, (testObject) => {
            outBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => instruction(treeBuilder, testObject));
        });
    });
}

function applyOnly(rootSuite, eventBus) {
    if (!rootSuite.hasOnly()) {
        return;
    }

    eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
        let titles;

        treeBuilder.addTestFilter((test) => {
            if (!titles) {
                titles = [];
                rootSuite.filterOnly();
                rootSuite.eachTest((mochaTest) => titles.push(mochaTest.fullTitle()));
            }

            return titles.includes(test.fullTitle());
        });
    });
}

module.exports = {
    readFiles,
};
