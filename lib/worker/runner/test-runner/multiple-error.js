'use strict';

const _ = require('lodash');

const indent = '    ';

function prepareStack(error) {
    if (!error.stack) {
        return indent + error.message;
    }
    return error.stack
        .match(/[^\r\n]+/g)
        .map(str => indent + str)
        .join('\n');
}

module.exports = class MultipleError extends Error {
    constructor(errors = []) {
        super();

        this.name = this.constructor.name;
        this.message = errors.map(e => e.message).join('; ');
        this.stack = errors.length === 1
            ? errors[0].stack
            : [this.message, ...errors.map(prepareStack)].join('\n');
        this.errors = errors.map(e => _.pick(e, ['name', 'message', 'stack', 'stateName', 'screenshot']));
    }
};
