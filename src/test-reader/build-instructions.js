const _ = require("lodash");
const validators = require("../validators");
const env = require("../utils/env");
const RuntimeConfig = require("../config/runtime-config");

class InstructionsList {
    #commonInstructions;
    #fileInstructions;

    constructor() {
        this.#commonInstructions = [];
        this.#fileInstructions = new Map();
    }

    push(fn, file) {
        const instructions = file ? this.#fileInstructions.get(file) || [] : this.#commonInstructions;

        instructions.push(fn);

        if (file && !this.#fileInstructions.has(file)) {
            this.#fileInstructions.set(file, instructions);
        }

        return this;
    }

    exec(files, ctx = {}) {
        this.#commonInstructions.forEach(fn => fn(ctx));

        files.forEach(file => {
            const instructions = this.#fileInstructions.get(file) || [];
            instructions.forEach(fn => fn(ctx));
        });
    }
}

function extendWithBrowserId({ treeBuilder, browserId }) {
    treeBuilder.addTrap(testObject => {
        testObject.browserId = browserId;
    });
}

function extendWithBrowserVersion({ treeBuilder, config }) {
    const {
        desiredCapabilities: { browserVersion, version },
    } = config;

    treeBuilder.addTrap(testObject => {
        testObject.browserVersion = browserVersion || version;
    });
}

function extendWithTimeout({ treeBuilder, config }) {
    const { testTimeout } = config;
    const { replMode } = RuntimeConfig.getInstance();

    if (!_.isNumber(testTimeout) || replMode?.enabled) {
        return;
    }

    treeBuilder.addTrap(testObject => {
        testObject.timeout = testTimeout;
    });
}

function buildGlobalSkipInstruction(config) {
    const { value: skipBrowsers, key: envKey } = env.parseCommaSeparatedValue([
        "TESTPLANE_SKIP_BROWSERS",
        "HERMIONE_SKIP_BROWSERS",
    ]);

    validators.validateUnknownBrowsers(skipBrowsers, config.getBrowserIds());

    return ({ treeBuilder, browserId }) => {
        if (!skipBrowsers.includes(browserId)) {
            return;
        }

        treeBuilder.addTrap(testObject => {
            testObject.skip({ reason: `The test was skipped by environment variable ${envKey}` });
        });
    };
}

module.exports = {
    InstructionsList,
    Instructions: {
        extendWithBrowserId,
        extendWithBrowserVersion,
        extendWithTimeout,
        buildGlobalSkipInstruction,
    },
};
