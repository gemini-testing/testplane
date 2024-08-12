import _ from "lodash";
import { validateUnknownBrowsers } from "../validators";
import env from "../utils/env";
import RuntimeConfig from "../config/runtime-config";
import { TreeBuilder } from "./tree-builder";
import { BrowserConfig } from "../config/browser-config";
import { Config } from "../config";

export type InstructionFnArgs = {
    treeBuilder: TreeBuilder;
    browserId: string;
    config: BrowserConfig & { passive?: boolean };
};

export type InstructionFn = (args: InstructionFnArgs) => void;

export class InstructionsList {
    #commonInstructions: InstructionFn[];
    #fileInstructions: Map<string, InstructionFn[]>;

    constructor() {
        this.#commonInstructions = [];
        this.#fileInstructions = new Map();
    }

    push(fn: InstructionFn, file?: string): InstructionsList {
        const instructions = file ? this.#fileInstructions.get(file) || [] : this.#commonInstructions;

        instructions.push(fn);

        if (file && !this.#fileInstructions.has(file)) {
            this.#fileInstructions.set(file, instructions);
        }

        return this;
    }

    exec(files: string[], ctx: InstructionFnArgs): void {
        this.#commonInstructions.forEach(fn => fn(ctx));

        files.forEach(file => {
            const instructions = this.#fileInstructions.get(file) || [];
            instructions.forEach(fn => fn(ctx));
        });
    }
}

function extendWithBrowserId({ treeBuilder, browserId }: InstructionFnArgs): void {
    treeBuilder.addTrap(testObject => {
        testObject.browserId = browserId;
    });
}

function extendWithBrowserVersion({ treeBuilder, config }: InstructionFnArgs): void {
    const {
        desiredCapabilities: { browserVersion, version },
    } = config as unknown as {
        desiredCapabilities: { browserVersion: string; version: string };
    };

    treeBuilder.addTrap(testObject => {
        testObject.browserVersion = browserVersion || version;
    });
}

function extendWithTimeout({ treeBuilder, config }: InstructionFnArgs): void {
    const { testTimeout } = config;
    const { replMode } = RuntimeConfig.getInstance();

    if (!_.isNumber(testTimeout) || replMode?.enabled) {
        return;
    }

    treeBuilder.addTrap(testObject => {
        testObject.timeout = testTimeout;
    });
}

function disableInPassiveBrowser({ treeBuilder, config }: InstructionFnArgs): void {
    const { passive } = config;

    if (!passive) {
        return;
    }

    treeBuilder.addTrap(testObject => {
        testObject.disable();
    });
}

function buildGlobalSkipInstruction(config: Config): InstructionFn {
    const { value: skipBrowsers, key: envKey } = env.parseCommaSeparatedValue([
        "TESTPLANE_SKIP_BROWSERS",
        "HERMIONE_SKIP_BROWSERS",
    ]);

    validateUnknownBrowsers(skipBrowsers, config.getBrowserIds());

    return ({ treeBuilder, browserId }) => {
        if (!skipBrowsers.includes(browserId)) {
            return;
        }

        treeBuilder.addTrap(testObject => {
            testObject.skip({ reason: `The test was skipped by environment variable ${envKey}` });
        });
    };
}

export const Instructions = {
    extendWithBrowserId,
    extendWithBrowserVersion,
    extendWithTimeout,
    disableInPassiveBrowser,
    buildGlobalSkipInstruction,
};
