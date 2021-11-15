/* global window, document */
import url from 'url';
import Bluebird from 'bluebird';
import { clientBridge, browser } from 'gemini-core';
import _ from 'lodash';
import webdriverio from 'webdriverio';
import { sessionEnvironmentDetector } from '@wdio/utils';

import Browser from './browser';
import commandsList from './commands';
import * as logger from '../utils/logger';

import type { Capabilities, Options } from '@wdio/types';
import type { events, Image, Calibrator } from 'gemini-core';
import type { Page } from 'gemini-core/lib/types/page';
import type { CalibrationResult } from 'gemini-core/lib/types/calibrator';
import type { ClientBridge } from 'gemini-core/lib/client-bridge';
import type { Size } from 'png-img';
import type Config from '../config';

export default class ExistingBrowser extends Browser {
    private _emitter: events.AsyncEmitter;
    private _camera: browser.Camera;
    private _meta;
    private _clientBridge: ClientBridge | undefined;
    private _calibration: CalibrationResult | undefined;

    public static create(config: Config, id: string, version: string, emitter: events.AsyncEmitter): ExistingBrowser {
        return new this(config, id, version, emitter);
    }

    constructor(config: Config, id: string, version: string, emitter: events.AsyncEmitter) {
        super(config, id, version);

        this._emitter = emitter;
        this._camera = browser.Camera.create(this._config.screenshotMode, () => this._takeScreenshot());

        this._meta = this._initMeta();
    }

    public async init({sessionId, sessionCaps, sessionOpts} = {}, calibrator: Calibrator) {
        this._session = await this._attachSession({sessionId, sessionCaps, sessionOpts});

        this._addHistory();
        this._addCommands();

        try {
            this.config.prepareBrowser && this.config.prepareBrowser(this.publicAPI);
        } catch (e) {
            logger.warn(`WARN: couldn't prepare browser ${this.id}\n`, e.stack);
        }

        await this._prepareSession(sessionId);
        await this._performCalibration(calibrator);
        await this._buildClientScripts();

        return this;
    }

    async reinit(sessionId: string, sessionOpts) {
        this._session.extendOptions(sessionOpts);
        await this._prepareSession(sessionId);

        return this;
    }

    public markAsBroken(): void {
        this.applyState({isBroken: true});

        this._stubCommands();
    }

    public quit(): void {
        this.sessionId = null;
        this._meta = this._initMeta();
        this._state = {isBroken: false};
    }

    async prepareScreenshot(selectors, opts = {}) {
        opts = _.extend(opts, {
            usePixelRatio: this._calibration ? this._calibration.usePixelRatio : true
        });

        const result = await this._clientBridge.call('prepareScreenshot', [selectors, opts]);
        if (result.error) {
            throw new Error(`Prepare screenshot failed with error type '${result.error}' and error message: ${result.message}`);
        }
        return result;
    }

    public async open(url: string): Promise<string> {
        return this._session.url(url);
    }

    public async evalScript<T>(script: string): Promise<T> {
        return this._session.execute(`return ${script}`);
    }

    public async injectScript<T>(script: string): Promise<T> {
        return this._session.execute(script);
    }

    public async captureViewportImage(page: Page, screenshotDelay?: number): Promise<Image> {
        if (screenshotDelay) {
            await Bluebird.delay(screenshotDelay);
        }

        return this._camera.captureViewportImage(page);
    }

    public scrollBy(params) {
        return this._session.execute(function(params) {
            var elem, xVal, yVal;

            if (params.selector) {
                elem = document.querySelector(params.selector);

                if (!elem) {
                    throw new Error(
                        'Scroll screenshot failed with: ' +
                        'Could not find element with css selector specified in "selectorToScroll" option: ' +
                        params.selector
                    );
                }

                xVal = elem.scrollLeft + params.x;
                yVal = elem.scrollTop + params.y;
            } else {
                elem = window;
                xVal = window.pageXOffset + params.x;
                yVal = window.pageYOffset + params.y;
            }

            return elem.scrollTo(xVal, yVal);
        }, params);
    }

    public async attach(
        sessionId: string,
        sessionCaps: Capabilities.DesiredCapabilities,
        sessionOpts: Options.WebdriverIO
    ): Promise<void> {
        this._session = await this._attachSession(sessionId, sessionCaps, sessionOpts);

        this._addHistory();
        this._addCommands();
    }

    private _attachSession({
        sessionId,
        sessionCaps,
        sessionOpts = {}
    }: {
        sessionId: string;
        sessionCaps: Capabilities.DesiredCapabilities;
        sessionOpts: any;
    }) {
        const detectedSessionEnvFlags = sessionEnvironmentDetector({
            capabilities: sessionCaps,
            requestedCapabilities: sessionOpts.capabilities
        });

        return webdriverio.attach({
            sessionId,
            ...sessionOpts,
            ...detectedSessionEnvFlags,
            ...this._config.sessionEnvFlags,
            options: sessionOpts,
            capabilities: {...sessionOpts.capabilities, ...sessionCaps},
            requestedCapabilities: sessionOpts.capabilities
        });
    }

    private _initMeta() {
        return {
            pid: process.pid,
            browserVersion: this.version,
            ...this._config.meta
        };
    }

    private _takeScreenshot(): Promise<string> {
        return this.publicAPI.takeScreenshot();
    }

    protected _addCommands(): void {
        this._addMetaAccessCommands(this.publicAPI);
        this._decorateUrlMethod(this.publicAPI);

        commandsList.forEach((command) => require(`./commands/${command}`)(this));

        super._addCommands();
    }

    private _addMetaAccessCommands(session: webdriverio.Browser<'async'>): void {
        session.addCommand('setMeta', (key, value) => this._meta[key] = value);
        session.addCommand('getMeta', (key) => key ? this._meta[key] : this._meta);
    }

    private _decorateUrlMethod(session: webdriverio.Browser<'async'>): void {
        session.overwriteCommand('url', async (origUrlFn, uri) => {
            if (!uri) {
                return session.getUrl();
            }

            const newUri = this._resolveUrl(uri);
            this._meta.url = newUri;

            if (this._config.urlHttpTimeout) {
                this.setHttpTimeout(this._config.urlHttpTimeout);
            }

            const result = await origUrlFn(newUri);

            if (this._config.urlHttpTimeout) {
                this.restoreHttpTimeout();
            }

            if (this._clientBridge) {
                await this._clientBridge.call('resetZoom');
            }

            return result;
        });
    }

    private _resolveUrl(uri: string): string {
        return this._config.baseUrl ? url.resolve(this._config.baseUrl, uri) : uri;
    }

    private async _prepareSession(sessionId: string): Promise<void> {
        this._attach(sessionId);
        await this._setOrientation(this.config.orientation);
        await this._setWindowSize(this.config.windowSize);
    }

    public async _setOrientation(orientation?: string): Promise<void> {
        if (orientation) {
            await this.publicAPI.setOrientation(orientation);
        }
    }

    public async _setWindowSize(size: Size) {
        if (size) {
            await this._session.setWindowSize(size.width, size.height);
        }
    }

    private _performCalibration(calibrator: Calibrator) {
        if (!this.config.calibrate || this._calibration) {
            return Bluebird.resolve();
        }

        return calibrator.calibrate(this)
            .then((calibration) => {
                this._calibration = calibration;
                this._camera.calibrate(calibration);
            });
    }

    private _buildClientScripts() {
        return clientBridge.build(this, {calibration: this._calibration})
            .then((clientBridge) => this._clientBridge = clientBridge);
    }

    private _attach(sessionId: string): void {
        this.sessionId = sessionId;
    }

    private _stubCommands(): void {
        for (let commandName of this._session.commandList) {
            if (commandName === 'deleteSession') {
                continue;
            }

            if (_.isFunction(this._session[commandName])) {
                this._session.overwriteCommand(commandName, () => { });
            }
        }
    }

    get meta() {
        return this._meta;
    }

    get emitter() {
        return this._emitter;
    }
};
