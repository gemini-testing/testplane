'use strict';

const path = require('path');
const QEmitter = require('qemitter');
const qUtils = require('qemitter/utils');
const RunnerEvents = require('../../constants/runner-events');

module.exports = class BaseMochaRunner extends QEmitter {
    static create(browserId, config, browserPool, testSkipper) {
        return new this(browserId, config, browserPool, testSkipper);
    }

    constructor(browserId, config, browserPool, testSkipper, modules) {
        super();

        this._config = config.forBrowser(browserId);
        this._mochaBuilder = modules.MochaBuilder.create(browserId, config.system, browserPool, testSkipper);

        qUtils.passthroughEvent(this._mochaBuilder, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);
    }

    init(suitePaths) {
        this._mochas = this._mochaBuilder.buildAdapters(suitePaths);

        BaseMochaRunner._validateUniqTitles(this._mochas);
        this._mochas.forEach((mocha) => mocha.disableHooksInSkippedSuites());

        return this;
    }

    static _validateUniqTitles(mochas) {
        const titles = {};

        [].concat(mochas).forEach((mocha) => {
            mocha.suite.eachTest((test) => {
                const fullTitle = test.fullTitle();
                const relatePath = path.relative(process.cwd(), test.file);

                if (!titles[fullTitle]) {
                    titles[fullTitle] = path.relative(process.cwd(), test.file);
                    return;
                }

                if (titles[fullTitle] === relatePath) {
                    throw new Error(`Tests with the same title '${fullTitle}'` +
                        ` in file '${titles[fullTitle]}' can't be used`);
                } else {
                    throw new Error(`Tests with the same title '${fullTitle}'` +
                        ` in files '${titles[fullTitle]}' and '${relatePath}' can't be used`);
                }
            });
        });
    }
};
