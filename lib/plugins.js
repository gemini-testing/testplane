'use strict';

var _ = require('lodash');
var prefix = require('../package.json').name + '-';

module.exports = {
    load: function(hermione) {
        _(hermione.config.plugins)
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

                plugin(hermione, opts);
            })
            .run();
    }
};
