'use strict';

const _ = require('lodash');
const q = require('q');
const Browser = require('./browser');
const signalHandler = require('../signal-handler');
const logger = require('../utils/logger');

module.exports = class NewBrowser extends Browser {
    constructor(config, id) {
        super(config, id);

        signalHandler.on('exit', () => this.quit());
    }

    _addCommands() {
        this._addExtendOptionsMethod(this._session);

        super._addCommands();
    }

    _addExtendOptionsMethod(session) {
        session.addCommand('extendOptions', (opts) => {
            _.extend(session.requestHandler.defaultOptions, opts);
        });
    }

    init(calibrator) {
        return q(() => this._session)
            .call()
            .then(() => this._switchOffScreenshotOnReject())
            .then(() => this._setHttpTimeout(this._config.sessionRequestTimeout))
            .then(() => this._session.init())
            .then(() => this._setDefaultWindowSize())
            .then(() => this._performCalibration(calibrator))
            .then(() => this._restoreHttpTimeout())
            .then(() => this._switchOnScreenshotOnReject())
            .thenResolve(this);
    }

    _setHttpTimeout(timeout) {
        this._session.extendOptions({connectionRetryTimeout: timeout});
    }

    _restoreHttpTimeout() {
        this._setHttpTimeout(this._config.httpTimeout);
    }

    _switchOnScreenshotOnReject() {
        this._session.extendOptions({screenshotOnReject: this._getScreenshotOnRejectOpts()});
    }

    _switchOffScreenshotOnReject() {
        this._session.extendOptions({screenshotOnReject: false});
    }

    _setDefaultWindowSize() {
        const windowSize = this.windowSize;

        return windowSize ? this._session.windowHandleSize(windowSize) : q();
    }

    _performCalibration(calibrator) {
        if (!this.config.calibrate || this._camera.isCalibrated()) {
            return;
        }

        return calibrator.calibrate(this)
            .then((calibration) => this._camera.calibrate(calibration));
    }

    open(url) {
        return this._session.url(url);
    }

    evalScript(script) {
        return this._session.execute(`return ${script}`);
    }

    reset() {
        return this._session
            .then(() => {
                if (this.changes.originWindowSize) {
                    return this._setDefaultWindowSize()
                        .then(() => this.updateChanges({originWindowSize: null}));
                }
            });
    }

    quit() {
        // Do not work without 'then' because of webdriverio realization of promise API
        return this._session
            .then(() => this._setHttpTimeout(this._config.sessionQuitTimeout))
            .then(() => this._switchOffScreenshotOnReject())
            .then(() => this._session.end())
            .catch((e) => logger.warn(`WARNING: Can not close session: ${e.message}`));
    }
};
