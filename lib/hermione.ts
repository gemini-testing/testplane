import _ from 'lodash';
import * as eventsUtils from 'gemini-core/lib/events/utils';

import RunnerStats from './stats';
import BaseHermione from './base-hermione';
import Runner from './runner';
import * as RuntimeConfig from './config/runtime-config';
import RunnerEvents, {getSyncEvents} from './constants/runner-events';
import signalHandler from './signal-handler';
import TestReader from './test-reader';
import TestCollection from './test-collection';
import { validateUnknownBrowsers } from './validators';
import * as logger from './utils/logger';

import type { Command } from '@gemini-testing/commander';
import type Bluebird from 'bluebird';

import type {BaseHermioneEvents} from './base-hermione';
import type * as Reporters from './reporters';
import type { Config as ConfigType } from './types/config';

interface HermioneEvents extends BaseHermioneEvents {
    [RunnerEvents.CLI]: (parser: Command) => void;
    [RunnerEvents.AFTER_TESTS_READ]: (collection: TestCollection) => void;
    [RunnerEvents.TEST_FAIL]: () => void;
    [RunnerEvents.ERROR]: (error: Error) => void;
}

declare interface Hermione {
    on<U extends keyof HermioneEvents>(
        event: U, listener: HermioneEvents[U]
    ): this;

    emit<U extends keyof HermioneEvents>(
        event: U, ...args: Parameters<HermioneEvents[U]>
    ): boolean;

    emitAndWait<U extends keyof HermioneEvents>(
        event: U, ...args: Parameters<HermioneEvents[U]>
    ): Bluebird<void>;
}

type HermioneRunOptions = {
    reporters: Array<string>;
    browsers?: Array<string>;
    sets?: Array<string>;
    grep?: string;
    updateRefs: boolean;
    requireModules?: Array<string>;
    inspectMode?: {
        inspect?: string;
        inspectBrk?: string;
    };
};

class Hermione extends BaseHermione {
    private _failed: boolean;
    private _runner?: Runner;

    constructor(config: ConfigType | string) {
        super(config);

        this._failed = false;
    }

    public extendCli(parser: Command): void {
        this.on(RunnerEvents.INIT, () => {});
        this.emit(RunnerEvents.CLI, parser);
    }

    public async run(testPaths: Array<string>, {browsers, sets, grep, updateRefs, requireModules, inspectMode, reporters}: HermioneRunOptions = {}) {
        validateUnknownBrowsers(browsers, _.keys(this._config.browsers));

        RuntimeConfig.getInstance().extend({updateRefs, requireModules, inspectMode});

        this._runner = Runner.create(this._config, this._interceptors);

        this
            .on(RunnerEvents.TEST_FAIL, () => this._fail())
            .on(RunnerEvents.ERROR, (err) => this.halt(err));

        _.forEach(reporters, (reporter) => applyReporter(this, reporter));

        eventsUtils.passthroughEvent(this._runner, this, _.values(getSyncEvents()));
        eventsUtils.passthroughEventAsync(this._runner, this, _.values(getSyncEvents()));
        eventsUtils.passthroughEventAsync(signalHandler, this, RunnerEvents.EXIT);

        await this._init();
        this._runner.init();
        await this._runner.run(await this._readTests(testPaths, {browsers, sets, grep}), RunnerStats.create(this));

        return !this.isFailed();
    }

    async _readTests(testPaths: TestCollection | Array<string>, opts: {browsers:}) {
        return testPaths instanceof TestCollection ? testPaths : await this.readTests(testPaths, opts);
    }

    public addTestToRun(test, browserId) {
        return this._runner ? this._runner.addTestToRun(test, browserId) : false;
    }

    public async readTests(testPaths: Array<string>, {browsers, sets, grep, silent, ignore} = {}): Promise<TestCollection> {
        const testReader = TestReader.create(this._config);

        if (!silent) {
            await this._init();

            eventsUtils.passthroughEvent(testReader, this, [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ]);
        }

        const specs = await testReader.read({paths: testPaths, browsers, ignore, sets, grep});
        const collection = TestCollection.create(specs);

        collection.getBrowsers().forEach((bro) => {
            if (this._config.forBrowser(bro).strictTestsOrder) {
                collection.sortTests(bro, ({id: a}, {id: b}) => a < b ? -1 : 1);
            }
        });

        if (!silent) {
            this.emit(RunnerEvents.AFTER_TESTS_READ, collection);
        }

        return collection;
    }

    public isFailed(): boolean {
        return this._failed;
    }

    private _fail(): void {
        this._failed = true;
    }

    public isWorker(): boolean {
        return false;
    }

    public halt(err: Error, timeout: number = 60000): void {
        logger.error(`Terminating on critical error: ${err}`);

        this._fail();
        this._runner && this._runner.cancel();

        if (timeout === 0) {
            return;
        }

        setTimeout(() => {
            logger.error('Forcing shutdown...');
            process.exit(1);
        }, timeout).unref();
    }
};

function applyReporter<K extends keyof typeof Reporters>(runner: Hermione, reporter: K | typeof Reporters[K]): void {
    if (typeof reporter === 'string') {
        try {
            reporter = require('./reporters/' + reporter);
        } catch (e: any) {
            if (e.code === 'MODULE_NOT_FOUND') {
                throw new Error('No such reporter: ' + reporter);
            }

            throw e;
        }
    }

    if (typeof reporter !== 'function') {
        throw new TypeError('Reporter must be a string or a function');
    }

    const Reporter = reporter;

    new Reporter().attachRunner(runner);
}

export default Hermione;
