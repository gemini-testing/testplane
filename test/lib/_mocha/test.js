'use strict';

const _ = require('lodash');
const Runnable = require('./runnable');

module.exports = class Test extends Runnable {
    constructor(parent, options) {
        options = options || {};

        super(parent, options);

        this.title = options.title || 'some-test';
        this.fn = options.fn || _.noop;
        this.file = options.file || null;
        this.pending = options.skipped || false;
    }
};
