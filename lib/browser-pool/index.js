'use strict';

const BrowserPool = require('../core/browser-pool');

exports.create = function(config, emitter) {
    return BrowserPool.create(config, emitter);
};
