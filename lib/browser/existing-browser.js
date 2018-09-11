'use strict';

const Promise = require('bluebird');
const {clientBridge, browser: {Camera}} = require('gemini-core');
const _ = require('lodash');
const url = require('url');
const Browser = require('./browser');
const commandsList = require('./commands');
const logger = require('../utils/logger');

module.exports = class ExistingBrowser extends Browser {
    constructor(config, id) {
        super(config, id);

        this._camera = Camera.create(this._config.screenshotMode, () => this._takeScreenshot());

        this._meta = _.extend({}, this._config.meta);
    }

    _takeScreenshot() {
        return this._session.screenshot().then(({value}) => value);
    }

    _addCommands() {
        this._addMetaAccessCommands(this._session);
        this._decorateUrlMethod(this._session);

        commandsList.forEach((command) => require(`./commands/${command}`)(this));

        super._addCommands();
    }

    _addMetaAccessCommands(session) {
        session.addCommand('setMeta', (key, value) => this._meta[key] = value);
        session.addCommand('getMeta', (key) => key ? this._meta[key] : this._meta);
    }

    _decorateUrlMethod(session) {
        const baseUrlFn = session.url.bind(session);

        session.addCommand('url', (uri) => {
            if (!uri) {
                return baseUrlFn(uri);
            }

            const newUri = this._resolveUrl(uri);
            this._meta.url = newUri;
            return baseUrlFn(newUri)
                .then((res) => this._clientBridge ? this._clientBridge.call('resetZoom').then(() => res) : res);
        }, true); // overwrite original `url` method
    }

    _resolveUrl(uri) {
        return this._config.baseUrl ? url.resolve(this._config.baseUrl, uri) : uri;
    }

    async init(sessionId, calibrator) {
        try {
            this.config.prepareBrowser && this.config.prepareBrowser(this.publicAPI);
        } catch (e) {
            logger.warn(`WARN: couldn't prepare browser ${this.id}\n`, e.stack);
        }

        await this._attach(sessionId);
        await this._setOrientation(this.config.orientation);
        await this._performCalibration(calibrator);
        await this._buildClientScripts();

        return this;
    }

    async reinit(sessionId) {
        await this._attach(sessionId);
        await this._setOrientation(this.config.orientation);

        return this;
    }

    async _setOrientation(orientation) {
        if (orientation) {
            await this._session.setOrientation(orientation);
        }
    }

    _performCalibration(calibrator) {
        if (!this.config.calibrate || this._calibration) {
            return Promise.resolve();
        }

        return calibrator.calibrate(this)
            .then((calibration) => {
                this._calibration = calibration;
                this._camera.calibrate(calibration);
            });
    }

    _buildClientScripts() {
        return clientBridge.build(this, {calibration: this._calibration})
            .then((clientBridge) => this._clientBridge = clientBridge);
    }

    _attach(sessionId) {
        this.sessionId = sessionId;

        return Promise.resolve();
    }

    quit() {
        this.sessionId = null;
        this._session.commandList.splice(0);
        this._meta = _.extend({}, this._config.meta);
        this._changes = {originWindowSize: null};
    }

    prepareScreenshot(selectors, opts = {}) {
        opts = _.extend(opts, {
            usePixelRatio: this._calibration ? this._calibration.usePixelRatio : true
        });

        return this._clientBridge.call('prepareScreenshot', [selectors, opts]);
    }

    open(url) {
        return this._session.url(url);
    }

    evalScript(script) {
        return this._session.execute(`return ${script}`).then(({value}) => value);
    }

    injectScript(script) {
        return this._session.execute(script);
    }

    captureViewportImage(page) {
        return Promise.delay(this.config.screenshotDelay)
            .then(() => this._camera.captureViewportImage(page));
    }

    scrollBy(x, y) {
        return this._session.execute(`return window.scrollBy(${x},${y})`).then(({value}) => value);
    }

    get meta() {
        return this._meta;
    }
};
