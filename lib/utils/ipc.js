'use strict';

const _ = require('lodash');

module.exports = {
    emit: (event) => process.send({event}),
    on: (event, baseHandler) => {
        process.on('message', (...args) => {
            if (event !== _.get(args[0], 'event')) {
                return;
            }

            baseHandler(...args);
        });
    }
};
