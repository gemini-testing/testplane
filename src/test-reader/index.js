const _ = require("lodash");
const { EventEmitter } = require("events");
const Promise = require("bluebird");
const { passthroughEvent } = require("../events/utils");
const SetsBuilder = require("./sets-builder");
const { BrowserTestParser: TestParser } = require("./browser-test-parser");
const TestSkipper = require("./test-skipper");
const Events = require("../constants/runner-events");
const env = require("../utils/env");

module.exports = class TestReader extends EventEmitter {
    #config;
    #testSkipper;

    static create(...args) {
        return new this(...args);
    }

    constructor(config) {
        super();

        this.#config = config;
        this.#testSkipper = TestSkipper.create(this.#config);
    }

    async read(options = {}) {
        const { paths, browsers, ignore, sets, grep } = options;

        const { fileExtensions } = this.#config.system;
        const setCollection = await SetsBuilder.create(this.#config.sets, { defaultDir: require("../../package").name })
            .useFiles(paths)
            .useSets((sets || []).concat(env.parseCommaSeparatedValue("HERMIONE_SETS")))
            .useBrowsers(browsers)
            .build(process.cwd(), { ignore }, fileExtensions);

        const filesByBro = setCollection.groupByBrowser();

        const parsersWithFiles = Object.entries(filesByBro).map(([browserId, files]) => [
            browserId,
            this.#makeParser(grep),
            files,
        ]);
        const loadedParsers = await Promise.mapSeries(parsersWithFiles, async ([browserId, parser, files]) =>
            Promise.all([browserId, await parser.loadFiles(files, this.#config)]),
        );
        const testGroups = loadedParsers.map(([browserId, parser]) => this.#parse(parser, browserId));
        const testsByBro = _.zipObject(Object.keys(filesByBro), testGroups);

        validateTests(testsByBro, options);

        return testsByBro;
    }

    #makeParser(grep) {
        const parser = TestParser.create();

        passthroughEvent(parser, this, [Events.BEFORE_FILE_READ, Events.AFTER_FILE_READ]);

        if (grep) {
            parser.applyGrep(grep);
        }

        return parser;
    }

    #parse(parser, browserId) {
        if (this.#testSkipper.shouldBeSkipped(browserId)) {
            parser.addRootSuiteDecorator(this.#testSkipper.getSuiteDecorator());
        }

        return parser.parse(browserId, this.#config.forBrowser(browserId));
    }
};

function validateTests(testsByBro, options) {
    const tests = _.flatten(Object.values(testsByBro));
    const stringifiedOpts = convertOptions(options);

    if (!_.isEmpty(tests) && tests.some(test => !test.silentSkip)) {
        return;
    }

    if (_.isEmpty(stringifiedOpts)) {
        throw new Error(`There are no tests found. Try to specify [${Object.keys(options).join(", ")}] options`);
    } else {
        throw new Error(`There are no tests found by the specified options:\n${stringifiedOpts}`);
    }
}

function convertOptions(obj) {
    let result = "";
    for (let key of _.keys(obj)) {
        if (!_.isEmpty(obj[key])) {
            if (_.isArray(obj[key])) {
                result += `- ${key}: ${obj[key].join(", ")}\n`;
            } else {
                result += `- ${key}: ${obj[key]}\n`;
            }
        }
    }
    return result;
}
