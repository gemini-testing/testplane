'use strict';

const Promise = require('bluebird');
const {clientBridge} = require('gemini-core');
const _ = require('lodash');
const url = require('url');
const Browser = require('./browser');
const Camera = require('./camera');
const commandsList = require('./commands');
const logger = require('../utils/logger');

module.exports = class ExistingBrowser extends Browser {
    constructor(config, id) {
        super(config, id);

        this._camera = Camera.create(this);

        this._meta = _.extend({}, this._config.meta);
    }

    _addCommands() {
        this._addMetaAccessCommands(this._session);
        this._decorateUrlMethod(this._session);

        commandsList.forEach((command) => require(`./commands/${command}`)(this));

        super._addCommands();
    }

    _addMetaAccessCommands(session) {
        session.addCommand('setMeta', (key, value) => this._meta[key] = value);
        session.addCommand('getMeta', (key) => this._meta[key]);
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

    init(sessionId, calibrator) {
        try {
            this.config.prepareBrowser && this.config.prepareBrowser(this.publicAPI);
        } catch (e) {
            logger.warn(`WARN: couldn't prepare browser ${this.id}\n`, e.stack);
        }

        return this.attach(sessionId)
            .then(() => this._performCalibration(calibrator))
            .then(() => this._buildClientScripts());
    }

    _performCalibration(calibrator) {
        if (!this.config.calibrate || this._camera.isCalibrated()) {
            return Promise.resolve();
        }

        return calibrator.calibrate(this)
            .then((calibration) => this._camera.calibrate(calibration));
    }

    _buildClientScripts() {
        return clientBridge.build(this, {calibration: this._camera.calibration})
            .then((clientBridge) => this._clientBridge = clientBridge);
    }

    attach(sessionId) {
        this.sessionId = sessionId;

        return Promise.resolve(this);
    }

    quit() {
        this.sessionId = null;
        this._session.commandList.splice(0);
        this._meta = _.extend({}, this._config.meta);
        this._changes = {originWindowSize: null};
    }

    prepareScreenshot(selectors, opts = {}) {
        opts = _.extend(opts, {
            usePixelRatio: this._camera.calibration ? this._camera.calibration.usePixelRatio : true
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

    captureViewportImage() {
        return this._camera.captureViewportImage();
    }

    get meta() {
        return this._meta;
    }
};
