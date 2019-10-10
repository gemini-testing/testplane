'use strict';

const _ = require('lodash');
const {EventEmitter} = require('events');
const {passthroughEvent} = require('gemini-core').events.utils;
const SetsBuilder = require('gemini-core').SetsBuilder;
const TestParser = require('./mocha-test-parser');
const TestSkipper = require('./test-skipper');
const Events = require('../constants/runner-events');

module.exports = class TestReader extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }

    constructor(config) {
        super();

        this._config = config;
        this._testSkipper = TestSkipper.create(this._config);
    }

    async read({paths, browsers, ignore, sets, grep} = {}) {
        const setCollection = await SetsBuilder
            .create(this._config.sets, {defaultDir: require('../../package').name})
            .useFiles(paths)
            .useSets(sets)
            .useBrowsers(browsers)
            .build(process.cwd(), {ignore});

        TestParser.prepare();

        const filesByBro = setCollection.groupByBrowser();

        return _(filesByBro)
            .mapValues((files, browserId) => ({parser: this._makeParser(browserId, grep), files}))
            .mapValues(({parser, files}) => parser.loadFiles(files))
            .mapValues((parser) => parser.parse())
            .value();
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
