import Mocha from "mocha";
import { MochaEventBus } from "./mocha-event-bus.js";
import { TreeBuilderDecorator } from "./tree-builder-decorator.js";
import { TestReaderEvents } from "../../events/index.js";
import { MasterEvents } from "../../events/index.js";

export const readFiles = async (files, { esmDecorator, config, eventBus }) => {
    const mocha = new Mocha(config);
    mocha.fullTrace();

    initBuildContext(eventBus);
    initEventListeners(mocha.suite, eventBus);

    files.forEach(f => mocha.addFile(f));
    await mocha.loadFilesAsync({ esmDecorator });

    applyOnly(mocha.suite, eventBus);
};

function initBuildContext(outBus) {
    outBus.emit(TestReaderEvents.NEW_BUILD_INSTRUCTION, ctx => {
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

function passthroughFileEvents(inBus, outBus) {
    [
        [MochaEventBus.events.EVENT_FILE_PRE_REQUIRE, MasterEvents.BEFORE_FILE_READ],
        [MochaEventBus.events.EVENT_FILE_POST_REQUIRE, MasterEvents.AFTER_FILE_READ],
    ].forEach(([mochaEvent, ourEvent]) => {
        inBus.on(mochaEvent, (ctx, file) => outBus.emit(ourEvent, { file }));
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
