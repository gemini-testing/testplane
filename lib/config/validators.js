'use strict';

const _ = require('lodash');

exports.validateBrowsers = (browsers) => {
    if (_.isEmpty(browsers)) {
        throw new Error('"browsers" is required option and should not be empty');
    } else if (!_.isPlainObject(browsers)) {
        throw new Error('"browsers" should be an object');
    }
};
