'use strict';

var _ = require('lodash'),
    inherit = require('inherit'),
    EventEmitter = require('events').EventEmitter;

module.exports = inherit(EventEmitter, {
    __constructor: function(config) {
        this._config = config;
    },

    passthroughEvent: function(emitter, event) {
        if (_.isArray(event)) {
            event.forEach(this.passthroughEvent.bind(this, emitter));
            return;
        }

        emitter.on(event, this.emit.bind(this, event));
    }
});
