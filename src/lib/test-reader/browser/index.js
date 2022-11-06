const _ = require('lodash');
const commands = require('./commands');

module.exports = class BrowserConfigurator {
    constructor(browserIdOfRunningInstance, getBrowserIds) {
        this._browserIdOfRunningInstance = browserIdOfRunningInstance;
        this._availableBrowserIds = getBrowserIds;
        this._version = new commands.VersionCommand();
    }

    exposeAPI() {
        return (requiredBrowserId) => {
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

    _getApi() {
        const api = {
            version: (browserVersionToSet) => {
                this._version.execute(browserVersionToSet);

                return api;
            }
        };

        return api;
    }

    handleTest(test) {
        this._version.handleTest(test);
    }

    handleSuite(suite) {
        this._version.handleSuite(suite);
    }
};
