import { URLSearchParams } from 'url';
import URI from 'urijs';
import _ from 'lodash';
import webdriverio, { RemoteOptions } from 'webdriverio';

import Browser from './browser';
import signalHandler from '../signal-handler';
import * as logger from '../utils/logger';

import { Capabilities } from '@wdio/types';
import type Config from '../config';

import type {INewBrowser} from 'gemini-core';

const DEFAULT_PORT = 4444;
const OPTIONAL_SESSION_OPTS = [
    'outputDir', 'agent', 'headers', 'transformRequest', 'transformResponse', 'strictSSL',
    // cloud service opts
    'user', 'key', 'region', 'headless'
] as const;

export default class NewBrowser extends Browser implements INewBrowser {    
    public static create(config: Config, id: string, version: string): NewBrowser {
        return new NewBrowser(config, id, version);
    }

    constructor(config: Config, id: string, version: string) {
        super(config, id, version);

        signalHandler.on('exit', () => this.quit());
    }

    public async init(): Promise<this> {
        this._session = await this._createSession();

        this._addHistory();
        this._addCommands();

        this.restoreHttpTimeout();
        await this._setPageLoadTimeout();

        return this;
    }

    public async reset(): Promise<void> {
        return Promise.resolve();
    }

    public async quit(): Promise<void> {
        try {
            this.setHttpTimeout(this._config.sessionQuitTimeout);
            if (this._session) {
                await this._session.deleteSession();
            }
        } catch (e: any) {
            logger.warn(`WARNING: Can not close session: ${e.message}`);
        }
    }

    private _createSession(): Promise<webdriverio.Browser<'async'>> {
        const sessionOpts = this._getSessionOpts();

        return webdriverio.remote(sessionOpts);
    }

    public async _setPageLoadTimeout(): Promise<void> {
        if (!this._config.pageLoadTimeout) {
            return;
        }

        if (!this._session) {
            throw new Error('Session is not initialized.');
        }

        try {
            await this._session.setTimeout({pageLoad: this._config.pageLoadTimeout});
        } catch (e) {
            // edge with w3c does not support setting page load timeout
            if (this._session.isW3C && this._session.capabilities.browserName === 'MicrosoftEdge') {
                logger.warn(`WARNING: Can not set page load timeout: ${e.message}`);
            } else {
                throw e;
            }
        }
    }

    private _getSessionOpts(): RemoteOptions {
        const config = this._config;
        const gridUri = new URI(config.gridUrl);
        const capabilities = this.version
            ? this._extendCapabilitiesByVersion()
            : config.desiredCapabilities;

        const options: RemoteOptions = {
            protocol: gridUri.protocol(),
            hostname: this._getGridHost(gridUri),
            port: gridUri.port() ? parseInt(gridUri.port(), 10) : DEFAULT_PORT,
            path: gridUri.path(),
            queryParams: this._getQueryParams(gridUri.query()),
            capabilities,
            automationProtocol: config.automationProtocol,
            logLevel: this._debug ? 'trace' : 'error',
            connectionRetryTimeout: config.sessionRequestTimeout || config.httpTimeout,
            connectionRetryCount: 0, // hermione has its own advanced retries
            baseUrl: config.baseUrl,
            waitforTimeout: config.waitTimeout,
            waitforInterval: config.waitInterval
        };

        OPTIONAL_SESSION_OPTS.forEach((opt) => {
            if (!_.isNull(config[opt])) {
                options[opt] = config[opt];
            }
        });

        return options;
    }

    private _extendCapabilitiesByVersion(): Capabilities.DesiredCapabilities {
        const {desiredCapabilities, sessionEnvFlags} = this._config;
        const versionKeyName = desiredCapabilities.browserVersion || sessionEnvFlags.isW3C
            ? 'browserVersion'
            : 'version';

        return _.assign({}, desiredCapabilities, {[versionKeyName]: this.version});
    }

    private _getGridHost(url: URI): string {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname()
        }).toString().slice(2); // URIjs leaves `//` prefix, removing it
    }

    private _getQueryParams(query: string): {[x: string]: string} {
        if (_.isEmpty(query)) {
            return {};
        }

        const urlParams = new URLSearchParams(query);

        return Object.fromEntries(urlParams);
    }
};
