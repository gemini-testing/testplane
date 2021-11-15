import _ from 'lodash';
import { VersionCommand } from './commands';

import type { Test } from '../../types/mocha';

export type BrowserAPI = {
    version: (browserVersionToSet: string) => BrowserAPI;
};

export default class BrowserConfigurator {
    private _browserIdOfRunningInstance: string;
    private _availableBrowserIds: Array<string>;
    private _version: VersionCommand;

    constructor(browserIdOfRunningInstance: string, getBrowserIds: Array<string>) {
        this._browserIdOfRunningInstance = browserIdOfRunningInstance;
        this._availableBrowserIds = getBrowserIds;
        this._version = new VersionCommand();
    }

    public exposeAPI() {
        return (requiredBrowserId: string): BrowserAPI => {
            const isValidBrowserId = this._availableBrowserIds.includes(requiredBrowserId);

            if (!isValidBrowserId) {
                throw new Error(`browser "${requiredBrowserId}" was not found in config file`);
            }

            const api = this._getApi();
            const emptyApi = _.mapValues(api, () => () => emptyApi);
            const shouldSkipProcessingForBrowser = requiredBrowserId !== this._browserIdOfRunningInstance;

            return shouldSkipProcessingForBrowser
                ? emptyApi
                : api;
        };
    }

    private _getApi(): BrowserAPI {
        const api = {
            version: (browserVersionToSet: string): BrowserAPI => {
                this._version.execute(browserVersionToSet);

                return api;
            }
        };

        return api;
    }

    public handleTest(test: Test): void {
        this._version.handleTest(test);
    }

    public handleSuite(): void {
        this._version.handleSuite();
    }
};
