import _ from "lodash";
import { EventEmitter } from "events";
import { passthroughEvent } from "../events/utils";
import { SetsBuilder } from "./sets-builder";
import { TestParser } from "./test-parser";
import { MasterEvents } from "../events";
import env from "../utils/env";
import type { Config } from "../config";
import type { Test } from "./test-object";
import type { ReadTestsOpts } from "../testplane";

export type TestReaderOpts = { paths: string[] } & Partial<ReadTestsOpts>;

export class TestReader extends EventEmitter {
    #config;

    static create<T extends TestReader>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof TestReader>
    ): T {
        return new this(...args);
    }

    constructor(config: Config) {
        super();

        this.#config = config;
    }

    async read(options: TestReaderOpts): Promise<Record<string, Test[]>> {
        const { paths, browsers, ignore, sets, grep, tag, runnableOpts } = options;

        const { fileExtensions } = this.#config.system;
        const envSets = env.parseCommaSeparatedValue(["TESTPLANE_SETS", "HERMIONE_SETS"]).value;
        const setCollection = await SetsBuilder.create(this.#config.sets, { defaultPaths: ["testplane", "hermione"] })
            .useFiles(paths)
            .useSets((sets || []).concat(envSets))
            .useBrowsers(browsers!)
            .build(process.cwd(), { ignore }, fileExtensions);

        const parser = new TestParser();
        passthroughEvent(parser, this, [MasterEvents.BEFORE_FILE_READ, MasterEvents.AFTER_FILE_READ]);

        await parser.loadFiles(setCollection.getAllFiles(), { config: this.#config, runnableOpts });

        const filesByBro = setCollection.groupByBrowser();
        const testsByBro = _.mapValues(filesByBro, (files, browserId) =>
            parser.parse(files, { browserId, config: this.#config.forBrowser(browserId), grep, tag }),
        );

        validateTests(testsByBro, options, this.#config);

        return testsByBro;
    }
}

function validateTests(testsByBro: Record<string, Test[]>, options: TestReaderOpts, config: Config): void {
    const tests = _.flatten(Object.values(testsByBro));

    const singleTestModes = [
        { condition: options.replMode?.enabled, name: "repl mode" },
        { condition: options.keepBrowserMode?.enabled, name: "keep-browser mode" },
    ].filter(mode => mode.condition);

    for (const mode of singleTestModes) {
        const testsToRun = tests.filter(test => !test.disabled && !test.pending);
        const browsersToRun = _.uniq(testsToRun.map(test => test.browserId));

        if (testsToRun.length !== 1) {
            const count = testsToRun.length;
            const lines: string[] = [];

            lines.push(
                `${mode.name} requires exactly 1 test in 1 browser, but ${
                    count === 0 ? "no tests were" : `${count} tests were`
                } found.`,
            );

            if (count > 1) {
                lines.push(`\nThe following browsers have tests to run: ${browsersToRun.join(", ")}`);
            }

            lines.push(
                "\nWhat you can do:",
                "- Use --grep to narrow down to a single test: testplane --repl --grep 'exact test name'",
                "- Use --browser to narrow down to a single browser: testplane --repl --browser chrome",
                "- Use testplane.only.in(['chrome']) in your test file to target a specific browser",
            );

            throw new Error(lines.join("\n"));
        }
    }

    if ((!_.isEmpty(tests) && tests.some(test => !test.silentSkip)) || (_.isEmpty(tests) && config.lastFailed.only)) {
        return;
    }

    const stringifiedOpts = convertOptions(_.omit(options, "replMode", "keepBrowserMode"));
    if (_.isEmpty(stringifiedOpts)) {
        const lines: string[] = [];

        lines.push("No tests were found.");
        lines.push("\nTestplane scanned the configured test paths but found no runnable tests.");

        lines.push(
            "\nWhat you can do:",
            `- Check the 'sets' configuration in your testplane.config.ts to make sure paths are correct`,
            `- You can narrow the run using CLI options: ${Object.keys(options)
                .map(k => `--${k}`)
                .join(", ")}`,
            `- Example: testplane --browser chrome --grep 'my test'`,
        );

        throw new Error(lines.join("\n"));
    } else {
        const lines: string[] = [];

        lines.push("No tests were found matching the specified options.");
        lines.push(`\n${stringifiedOpts}`);

        lines.push(
            "\nWhat you can do:",
            "- Check that test file paths match the patterns in the 'sets' config",
            "- Verify the --grep pattern matches your test titles",
            "- Check that the --browser value matches a browser ID in your config",
        );

        throw new Error(lines.join("\n"));
    }
}

function convertOptions(obj: Record<string, unknown>): string {
    let result = "";
    for (const key of _.keys(obj)) {
        if (!_.isEmpty(obj[key]) || obj[key] instanceof RegExp) {
            if (_.isArray(obj[key])) {
                result += `- ${key}: ${(obj[key] as string[]).join(", ")}\n`;
            } else {
                result += `- ${key}: ${obj[key]}\n`;
            }
        }
    }
    return result;
}
