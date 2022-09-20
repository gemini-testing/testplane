'use strict';

const _ = require('lodash');
const {EventEmitter} = require('events');
const {passthroughEvent} = require('../core/events/utils');
const SetsBuilder = require('../core/sets-builder');
const TestParser = require('./mocha-test-parser');
const TestSkipper = require('./test-skipper');
const Events = require('../constants/runner-events');
const env = require('../utils/env');

module.exports = class TestReader extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }

    constructor(config) {
        super();

        this._config = config;
        this._testSkipper = TestSkipper.create(this._config);
    }

    async read(options = {}) {
        const {paths, browsers, ignore, sets, grep} = options;

        const {fileExtensions} = this._config.system;
        const setCollection = await SetsBuilder
            .create(this._config.sets, {defaultDir: require('../../package').name})
            .useFiles(paths)
            .useSets((sets || []).concat(env.parseCommaSeparatedValue('HERMIONE_SETS')))
            .useBrowsers(browsers)
            .build(process.cwd(), {ignore}, fileExtensions);

        TestParser.prepare();

        const filesByBro = setCollection.groupByBrowser();

        const testsByBro = _(filesByBro)
            .mapValues((files, browserId) => ({parser: this._makeParser(browserId, grep), files}))
            .mapValues(({parser, files}) => parser.loadFiles(files))
            .mapValues((parser) => parser.parse())
            .value();

        validateTests(testsByBro, options);

        return testsByBro;
    }

    _makeParser(browserId, grep) {
        const parser = TestParser.create(browserId, this._config);

        passthroughEvent(parser, this, [
            Events.BEFORE_FILE_READ,
            Events.AFTER_FILE_READ
        ]);

        return parser
            .applySkip(this._testSkipper)
            .applyConfigController()
            .applyGrep(grep);
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
