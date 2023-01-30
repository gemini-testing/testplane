const BaseCommand = require('./command');

module.exports = class VersionCommand extends BaseCommand {
    constructor() {
        super();

        this._oneTimeHandler = null;
        this._globalHandler = null;
    }

    execute(browserVersionToSet) {
        this._oneTimeHandler = (test) => {
            test.browserVersion = browserVersionToSet;
            test.hasBrowserVersionOverwritten = true;
        };
    }

    handleTest(test = {}) {
        const execute = this._oneTimeHandler || this._globalHandler;

        if (execute) {
            execute(test);
        }

        this._oneTimeHandler = null;
    }

    handleSuite() {
        this._globalHandler = this._oneTimeHandler || this._globalHandler;
        this._oneTimeHandler = null;
    }
};
