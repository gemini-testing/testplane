import _ from 'lodash';
import { EventEmitter } from 'events';
import { passthroughEvent } from 'gemini-core/lib/events/utils';
import { SetsBuilder } from 'gemini-core';

import TestParser from './mocha-test-parser';
import TestSkipper from './test-skipper';
import Events from '../constants/runner-events';
import * as env from '../utils/env';

import type Config from '../config';
import type { Test } from '../types/mocha';

type TestsReadOptions = {
    paths?: Array<string>;
    browsers?: Array<string>;
    sets?: Array<string>;
    ignore?: Array<string>;
    grep?: string;
};

export default class TestReader extends EventEmitter {
    private _config: Config;
    private _testSkipper: TestSkipper;

    public static create(config: Config): TestReader {
        return new this(config);
    }

    constructor(config: Config) {
        super();

        this._config = config;
        this._testSkipper = TestSkipper.create(this._config);
    }

    public async read(options: TestsReadOptions = {}): Promise<Record<string, Array<Test>>> {
        const {paths, browsers, ignore, sets, grep} = options;

        const {fileExtensions} = this._config.system;
        const setCollection = await SetsBuilder
            .create(this._config.sets, {defaultDir: require('../../package').name})
            .useFiles(paths || [])
            .useSets((sets || []).concat(env.parseCommaSeparatedValue('HERMIONE_SETS')))
            .useBrowsers(browsers || [])
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

    private _makeParser(browserId: string, grep?: string): TestParser {
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

function validateTests(testsByBro: Record<string, Array<Test>>, options: TestsReadOptions): void {
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

function convertOptions<T extends Record<PropertyKey, any>>(obj: T): string {
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
