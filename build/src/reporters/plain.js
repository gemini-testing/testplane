"use strict";
const chalk = require("chalk");
const BaseReporter = require("./base");
const icons = require("./utils/icons");
const helpers = require("./utils/helpers");
module.exports = class PlainReporter extends BaseReporter {
    _logTestInfo(test, icon) {
        super._logTestInfo(test, icon);
        if (icon === icons.RETRY || icon === icons.FAIL) {
            const testInfo = helpers.getTestInfo(test);
            this.informer.log(`   in file ${testInfo.file}`);
            this.informer.log(`   ${chalk.red(testInfo.error)}`);
        }
    }
};
//# sourceMappingURL=plain.js.map