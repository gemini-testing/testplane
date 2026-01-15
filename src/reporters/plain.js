"use strict";

const chalk = require("chalk");

const BaseReporter = require("./base");
const icons = require("./utils/icons");
const helpers = require("./utils/helpers");
const { withLogOptions } = require("../utils/logger");

module.exports = class PlainReporter extends BaseReporter {
    _logTestInfo(test, icon) {
        super._logTestInfo(test, icon);

        if (icon === icons.RETRY || icon === icons.FAIL) {
            const testInfo = helpers.getTestInfo(test);

            const noTimestampAndPrefix = withLogOptions({ timestamp: false, prefixEachLine: " ".repeat(4) });

            this.informer.log(`in file ${testInfo.file}`, noTimestampAndPrefix);
            this.informer.log(`${chalk.red(testInfo.error)}`, noTimestampAndPrefix);
        }
    }
};
