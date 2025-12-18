import { EventEmitter } from "events";
import { InstructionsList, Instructions } from "./build-instructions";
import { SkipController } from "./controllers/skip-controller";
import { OnlyController } from "./controllers/only-controller";
import { AlsoController } from "./controllers/also-controller";
import { ConfigController } from "./controllers/config-controller";
import { mkProvider } from "./controllers/browser-version-controller";
import { TreeBuilder } from "./tree-builder";
import { TestReaderEvents } from "../events";
import { Context, TestParserAPI } from "./test-parser-api";
import { MasterEvents } from "../events";
import _ from "lodash";
import clearRequire from "clear-require";
import path from "path";
import fs from "fs-extra";
import * as logger from "../utils/logger";
import { getShortMD5 } from "../utils/crypto";
import { Suite, Test } from "./test-object";
import { Config } from "../config";
import { isRunInBrowserEnv } from "../utils/config";
import { BrowserConfig } from "../config/browser-config";
import type { ReadTestsOpts } from "../testplane";
import { TagFilter } from "../utils/cli";

export type TestParserParseOpts = {
    browserId: string;
    grep?: RegExp;
    tag?: TagFilter;
    config: BrowserConfig;
};

type LoadFilesOpts = {
    config: Config;
    runnableOpts?: ReadTestsOpts["runnableOpts"];
};

const getFailedTestId = (test: { fullTitle: string; browserId: string; browserVersion?: string }): string =>
    getShortMD5(`${test.fullTitle}${test.browserId}${test.browserVersion}`);

export class TestParser extends EventEmitter {
    #failedTests: Set<string>;
    #buildInstructions: InstructionsList;

    constructor() {
        super();

        this.#failedTests = new Set();
        this.#buildInstructions = new InstructionsList();
    }

    async loadFiles(files: string[], { config, runnableOpts }: LoadFilesOpts): Promise<void> {
        const eventBus = new EventEmitter();
        const {
            system: { ctx, mochaOpts },
        } = config;

        const toolGlobals = {
            browser: mkProvider(config.getBrowserIds(), eventBus),
            config: ConfigController.create(eventBus),
            ctx: _.clone(ctx),
            only: OnlyController.create(eventBus),
            skip: SkipController.create(eventBus),
            also: AlsoController.create(eventBus),
        };

        global.testplane = toolGlobals;
        global.hermione = toolGlobals;

        this.#buildInstructions
            .push(Instructions.extendWithBrowserId)
            .push(Instructions.extendWithBrowserVersion)
            .push(Instructions.extendWithTimeout)
            .push(Instructions.disableInPassiveBrowser)
            .push(Instructions.buildGlobalSkipInstruction(config));

        this.#applyInstructionsEvents(eventBus);
        this.#passthroughFileEvents(eventBus, toolGlobals as unknown as Context);

        this.#clearRequireCache(files);

        const { readFiles } = await import("./mocha-reader");

        const rand = Math.random();
        const esmDecorator = (f: string): string => f + `?rand=${rand}`;
        const isBrowserEnv = isRunInBrowserEnv(config);

        await readFiles(files, { esmDecorator, config: mochaOpts, eventBus, runnableOpts, isBrowserEnv });

        if (config.lastFailed.only) {
            try {
                this.#failedTests = new Set();
                const inputPaths = _.isArray(config.lastFailed.input)
                    ? config.lastFailed.input
                    : config.lastFailed.input.split(",").map(v => v.trim());
                for (const inputPath of inputPaths) {
                    for (const test of await fs.readJSON(inputPath)) {
                        this.#failedTests.add(getFailedTestId(test));
                    }
                }
            } catch {
                logger.warn(
                    `Could not read failed tests data at ${config.lastFailed.input}. Running all tests instead`,
                );
            }
        }
    }

    #applyInstructionsEvents(eventBus: EventEmitter): void {
        let currentFile: string | undefined;

        eventBus
            .on(MasterEvents.BEFORE_FILE_READ, ({ file }) => (currentFile = file))
            .on(MasterEvents.AFTER_FILE_READ, () => (currentFile = undefined))
            .on(TestReaderEvents.NEW_BUILD_INSTRUCTION, instruction =>
                this.#buildInstructions.push(instruction, currentFile),
            );
    }

    #passthroughFileEvents(eventBus: EventEmitter, testplane: Context): void {
        const passthroughEvent_ = (event: MasterEvents[keyof MasterEvents], customOpts = {}): void => {
            eventBus.on(event, data =>
                this.emit(event, {
                    ...data,
                    testplane,
                    hermione: testplane,
                    ...customOpts,
                }),
            );
        };

        passthroughEvent_(MasterEvents.BEFORE_FILE_READ, { testParser: TestParserAPI.create(testplane, eventBus) });
        passthroughEvent_(MasterEvents.AFTER_FILE_READ);
    }

    #clearRequireCache(files: string[]): void {
        files.forEach(filename => {
            if (path.extname(filename) !== ".mjs") {
                clearRequire(path.resolve(filename));
            }
        });
    }

    parse(files: string[], { browserId, config, grep, tag }: TestParserParseOpts): Test[] {
        const treeBuilder = new TreeBuilder();

        this.#buildInstructions.exec(files, { treeBuilder, browserId, config });

        if (grep) {
            treeBuilder.addTestFilter((test: Test) => grep.test(test.fullTitle()));
        }

        if (tag) {
            treeBuilder.addTestFilter((test: Test) => {
                let current: Test | Suite | null = test;

                const allTags = new Set<string>([]);

                while (current) {
                    [...current.tags.keys()].forEach(item => allTags.add(item));

                    current = current.parent;
                }

                return tag(allTags);
            });
        }

        if (config.lastFailed?.only) {
            if (!this.#failedTests.size) {
                return [];
            }

            treeBuilder.addTestFilter(test => {
                return this.#failedTests.has(
                    getFailedTestId({
                        fullTitle: test.fullTitle(),
                        browserId: test.browserId,
                        browserVersion: test.browserVersion,
                    }),
                );
            });
        }

        const rootSuite = treeBuilder.applyFilters().getRootSuite();

        const tests = rootSuite!.getTests();

        this.#validateUniqTitles(tests);

        return tests;
    }

    #validateUniqTitles(tests: Test[]): void {
        const titles: Record<string, string> = {};

        tests.forEach(test => {
            const fullTitle = test.fullTitle();
            const relatePath = path.relative(process.cwd(), test.file);

            if (!titles[fullTitle]) {
                titles[fullTitle] = relatePath;
                return;
            }

            if (titles[fullTitle] === relatePath) {
                throw new Error(
                    `Tests with the same title '${fullTitle}'` + ` in file '${titles[fullTitle]}' can't be used`,
                );
            } else {
                throw new Error(
                    `Tests with the same title '${fullTitle}'` +
                        ` in files '${titles[fullTitle]}' and '${relatePath}' can't be used`,
                );
            }
        });
    }
}
