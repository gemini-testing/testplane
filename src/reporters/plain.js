import chalk from "chalk";

import BaseReporter from "./base";
import icons from "./utils/icons";
import helpers from "./utils/helpers";

export default class PlainReporter extends BaseReporter {
    _logTestInfo(test, icon) {
        super._logTestInfo(test, icon);

        if (icon === icons.RETRY || icon === icons.FAIL) {
            const testInfo = helpers.getTestInfo(test);

            this.informer.log(`   in file ${testInfo.file}`);
            this.informer.log(`   ${chalk.red(testInfo.error)}`);
        }
    }
}
