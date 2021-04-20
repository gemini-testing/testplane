'use strict';

const _ = require('lodash');
const URI = require('urijs');
const {URLSearchParams} = require('url');
const webdriverio = require('webdriverio');
const {sessionEnvironmentDetector} = require('@wdio/utils');

const OPTIONAL_SESSION_OPTS = [
    'outputDir', 'agent', 'headers', 'transformRequest', 'transformResponse', 'strictSSL',
    // cloud service opts
    'user', 'key', 'region', 'headless'
];

module.exports = class Browser {
    static create(config, id, version) {
        return new this(config, id, version);
    }

    constructor(config, id, version) {
        this.id = id;
        this.version = version;

        this._config = config.forBrowser(this.id);
        this._debug = config.system.debug;
        this._session = null;
        this._state = {
            isBroken: false
        };
    }

    async init() {
        this._session = await this._createSession();

        this._addCommands();
    }

    async attach(sessionId, sessionCaps) {
        this._session = await this._attachSession(sessionId, sessionCaps);

        this._addCommands();
    }

    setHttpTimeout(timeout) {
        if (timeout === null) {
            timeout = this._config.httpTimeout;
        }

        this._session.extendOptions({connectionRetryTimeout: timeout});
    }

    restoreHttpTimeout() {
        this.setHttpTimeout(this._config.httpTimeout);
    }

    _createSession() {
        const sessionOpts = this._getSessionOpts();

        return webdriverio.remote(sessionOpts);
    }

    _attachSession(sessionId, sessionCaps) {
        const sessionOpts = this._getSessionOpts({isAttach: true});

        // TODO: remove after - https://github.com/webdriverio/webdriverio/issues/6554
        const detectedSessionEnvFlags = sessionEnvironmentDetector({
            capabilities: sessionCaps,
            requestedCapabilities: sessionOpts.capabilities
        });

        return webdriverio.attach({
            sessionId,
            ...sessionOpts,
            ...detectedSessionEnvFlags,
            ...this._config.sessionEnvFlags
        });
    }

    _getSessionOpts({isAttach = false} = {}) {
        const config = this._config;
        const gridUri = new URI(config.gridUrl);
        const capabilities = this.version
            ? this._extendCapabilitiesByVersion()
            : config.desiredCapabilities;
        const connectionRetryTimeout = isAttach
            ? config.httpTimeout
            : config.sessionRequestTimeout || config.httpTimeout;

        const options = {
            protocol: gridUri.protocol(),
            hostname: this._getGridHost(gridUri),
            port: gridUri.port() && parseInt(gridUri.port(), 10),
            path: gridUri.path(),
            queryParams: this._getQueryParams(gridUri.query()),
            capabilities,
            automationProtocol: config.automationProtocol,
            logLevel: this._debug ? 'trace' : 'error',
            connectionRetryTimeout,
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

    _extendCapabilitiesByVersion() {
        const {desiredCapabilities, sessionEnvFlags} = this._config;
        const versionKeyName = desiredCapabilities.browserVersion || sessionEnvFlags.isW3C
            ? 'browserVersion'
            : 'version';

        return _.assign({}, desiredCapabilities, {[versionKeyName]: this.version});
    }

    _getGridHost(url) {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname()
        }).toString().slice(2); // URIjs leaves `//` prefix, removing it
    }

    _getQueryParams(query) {
        if (_.isEmpty(query)) {
            return {};
        }

        const urlParams = new URLSearchParams(query);
        return Object.fromEntries(urlParams);
    }

    _addCommands() {
        this._addExtendOptionsMethod(this._session);
    }

    _addExtendOptionsMethod(session) {
        session.addCommand('extendOptions', (opts) => {
            _.extend(session.options, opts);
        });
    }

    applyState(state) {
        _.extend(this._state, state);
    }

    get fullId() {
        return this.version
            ? `${this.id}.${this.version}`
            : this.id;
    }

    get publicAPI() {
        return this._session; // exposing webdriver API as is
    }

    get sessionId() {
        return this.publicAPI.sessionId;
    }

    set sessionId(id) {
        this.publicAPI.sessionId = id;
    }

    get config() {
        return this._config;
    }

    get state() {
        return this._state;
    }

    get capabilities() {
        return this.publicAPI.capabilities;
    }
};
