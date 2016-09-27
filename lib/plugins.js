'use strict';

var _ = require('lodash');
var prefix = require('../package.json').name + '-';

const utils = require('./utils');

const isPluginNotFound = (e, name) => {
    return e.toString().includes(`Error: Cannot find module '${name}'`);
}

module.exports = {
    load: function(hermione) {
        _(hermione.config.plugins)
            .pick(_.identity)
            .forEach(function(opts, name) {
                var fullName = _.startsWith(name, prefix) ? name : prefix + name,
                    plugin = (function() {
                        try {
                            return utils.require(fullName); // using require from utils for tests
                        } catch (e) {
                            if (!isPluginNotFound(e, fullName)) {
                                throw e;
                            }

                            return require(name);
                        }
                    })();

                opts = opts === true ? {} : opts;

                plugin(hermione, opts);
            })
            .run();
    }
};
