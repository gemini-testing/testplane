'use strict';

const chalk = require('chalk');

const logger = require('../utils').logger;
const BaseReporter = require('./base');
const icons = require('./utils/icons');
const helpers = require('./utils/helpers');

module.exports = class PlainReporter extends BaseReporter {
    _logTestInfo(test, icon) {
        super._logTestInfo(test, icon);

        if (icon === icons.RETRY || icon === icons.FAIL) {
            const testInfo = helpers.getTestInfo(test);

            logger.log(`   in file ${testInfo.file}`);
            logger.log(`   ${chalk.red(testInfo.error)}`);
        }
    }
};
