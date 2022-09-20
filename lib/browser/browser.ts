import _ from 'lodash';
import * as history from './history';

import type { Capabilities } from '@wdio/types';
import type { Browser as Session, RemoteOptions } from 'webdriverio';
import type Callstack from './history/callstack';
import type Config from '../config';
import type BrowserConfig from '../config/browser-config';

import type {IBrowser} from 'gemini-core';

type ExtendedAsyncSession = Session<'async'> & {
    extendOptions: (opts: Partial<RemoteOptions>) => void;
};

type BrowserState = {
    isBroken: boolean;
};

export default abstract class Browser implements IBrowser {
    public id: string;
    public version: string;
    protected _config: BrowserConfig;
    protected _debug: boolean;
    protected _session: ExtendedAsyncSession | null;
    private _callstackHistory: Callstack | null;
    protected _state: BrowserState;

    constructor(config: Config, id: string, version: string) {
        this.id = id;
        this.version = version;

        this._config = config.forBrowser(this.id);
        this._debug = config.system.debug;
        this._session = null;
        this._callstackHistory = null;
        this._state = {
            isBroken: false
        };
    }

    public setHttpTimeout(timeout: number | null): void {
        if (timeout === null) {
            timeout = this._config.httpTimeout;
        }

        this._session && this._session.extendOptions({connectionRetryTimeout: timeout});
    }

    public restoreHttpTimeout(): void {
        this.setHttpTimeout(this._config.httpTimeout);
    }

    public flushHistory() {
        return this._config.saveHistory
            ? (this._callstackHistory as Callstack).flush()
            : [];
    }

    public applyState(state: BrowserState): void {
        _.extend(this._state, state);
    }

    protected _addCommands(): void {
        this._addExtendOptionsMethod(this.publicAPI);
    }

    protected _addHistory(): void {
        if (this._config.saveHistory && this._session) {
            this._callstackHistory = history.initCommandHistory(this._session);
        }
    }

    private _addExtendOptionsMethod(session: Session<'async'>): void {
        session.addCommand('extendOptions', (opts: Partial<RemoteOptions>) => {
            _.extend(session.options, opts);
        });
    }

    public get fullId(): string {
        return this.version
            ? `${this.id}.${this.version}`
            : this.id;
    }

    public get publicAPI(): ExtendedAsyncSession {
        if (this._session === null) {
            throw new Error('TODO');
        }

        return this._session; // exposing webdriver API as is
    }

    public get sessionId(): string {
        return this.publicAPI.sessionId;
    }

    public set sessionId(id: string | null) {
        this.publicAPI.sessionId = id;
    }

    public get config() {
        return this._config;
    }

    public get state(): BrowserState {
        return this._state;
    }

    public get capabilities(): Capabilities.RemoteCapability {
        return this.publicAPI.capabilities;
    }
};
