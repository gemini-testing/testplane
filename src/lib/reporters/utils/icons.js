'use strict';

const chalk = require('chalk');

module.exports = {
    SUCCESS: chalk.green('\u2713'),
    WARN: chalk.bold.yellow('!'),
    FAIL: chalk.red('\u2718'),
    RETRY: chalk.yellow('⟳')
};
