const _ = require('lodash');
const {EventEmitter} = require('events');
const Promise = require('bluebird');
const {passthroughEvent} = require('../events/utils');
const SetsBuilder = require('./sets-builder');
const {BrowserTestParser: TestParser} = require('./browser-test-parser');
const TestSkipper = require('./test-skipper');
const Events = require('../constants/runner-events');
const env = require('../utils/env');

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
        const {paths, browsers, ignore, sets, grep} = options;

        const {fileExtensions} = this.#config.system;
        const setCollection = await SetsBuilder
            .create(this.#config.sets, {defaultDir: require('../../../package').name})
            .useFiles(paths)
            .useSets((sets || []).concat(env.parseCommaSeparatedValue('HERMIONE_SETS')))
            .useBrowsers(browsers)
            .build(process.cwd(), {ignore}, fileExtensions);

        const filesByBro = setCollection.groupByBrowser();

        const parsersWithFiles = Object.entries(filesByBro).map(([browserId, files]) => [this.#makeParser(browserId, grep), files]);
        const loadedParsers = await Promise.mapSeries(parsersWithFiles, async ([parser, files]) => await parser.loadFiles(files));
        const testGroups = loadedParsers.map((parser) => parser.parse());
        const testsByBro = _.zipObject(Object.keys(filesByBro), testGroups);

        validateTests(testsByBro, options);

        return testsByBro;
    }

    #makeParser(browserId, grep) {
        const parser = TestParser.create(browserId, this.#config);

        passthroughEvent(parser, this, [
            Events.BEFORE_FILE_READ,
            Events.AFTER_FILE_READ
        ]);

        if (this.#testSkipper.shouldBeSkipped(browserId)) {
            parser.addRootSuiteDecorator(this.#testSkipper.getSuiteDecorator());
        }

        if (grep) {
            parser.applyGrep(grep);
        }

        return parser;
    }
};

function validateTests(testsByBro, options) {
    const tests = _.flatten(Object.values(testsByBro));
    const stringifiedOpts = convertOptions(options);

    if (!_.isEmpty(tests) && tests.some((test) => !test.silentSkip)) {
        return;
    }

    if (_.isEmpty(stringifiedOpts)) {
        throw new Error(`There are no tests found. Try to specify [${Object.keys(options).join(', ')}] options`);
    } else {
        throw new Error(`There are no tests found by the specified options:\n${stringifiedOpts}`);
    }
}

function convertOptions(obj) {
    let result = '';
    for (let key of _.keys(obj)) {
        if (!_.isEmpty(obj[key])) {
            if (_.isArray(obj[key])) {
                result += `- ${key}: ${obj[key].join(', ')}\n`;
            } else {
                result += `- ${key}: ${obj[key]}\n`;
            }
        }
    }
    return result;
}
