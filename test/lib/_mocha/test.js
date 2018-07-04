'use strict';

const _ = require('lodash');
const Runnable = require('./runnable');

module.exports = class Test extends Runnable {
    constructor(parent, options) {
        options = options || {};

        if (_.isFunction(options)) {
            options = {fn: options};
        }

        super(parent, options);

        this.type = 'test';
        this.title = options.title || 'some-test';
        this.fn = options.fn || _.noop;
        this.file = options.file || '';
        this.pending = options.pending || false;
        this.silentSkip = options.silentSkip || false;
    }
};
