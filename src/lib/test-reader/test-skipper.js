const _ = require("lodash");
const validators = require("../validators");
const env = require("../utils/env");

module.exports = class TestSkipper {
    static create(config) {
        return new TestSkipper(config);
    }

    static #validateUnknownBrowsers(skipBrowsers, browsers) {
        validators.validateUnknownBrowsers(skipBrowsers, browsers);
    }

    constructor(config) {
        this._skipBrowsers = env.parseCommaSeparatedValue("HERMIONE_SKIP_BROWSERS");

        TestSkipper.#validateUnknownBrowsers(this._skipBrowsers, _.keys(config.browsers));
    }

    shouldBeSkipped(browserId) {
        return _.includes(this._skipBrowsers, browserId);
    }

    getSuiteDecorator() {
        return (suite) => {
            suite.skip({ reason: "The test was skipped by environment variable HERMIONE_SKIP_BROWSERS" });
        };
    }
};
