'use strict';

var _ = require('lodash');
var prefix = require('../package.json').name + '-';

module.exports = {
    load: function(e2eRunner) {
        _(e2eRunner.config.plugins)
            .pick(_.identity)
            .forEach(function(opts, name) {
                var fullName = _.startsWith(name, prefix) ? name : prefix + name,
                    plugin = (function() {
                        try {
                            return require(fullName);
                        } catch (e) {
                            return require(name);
                        }
                    })();

                opts = opts === true ? {} : opts;

                plugin(e2eRunner, opts);
            })
            .run();
    }
};
