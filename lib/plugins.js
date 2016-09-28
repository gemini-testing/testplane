'use strict';

const _ = require('lodash');

const prefix = require('../package.json').name + '-';
const utils = require('./utils');

const isPluginNotFound = (e, name) => {
    return e.toString().includes(`Error: Cannot find module '${name}'`);
};

module.exports = {
    load: function(hermione) {
        _(hermione.config.plugins)
            .pick(_.identity)
            .forEach(function(opts, name) {
                const fullName = _.startsWith(name, prefix) ? name : prefix + name;
                const plugin = (function() {
                        try {
                            return utils.require(fullName); // using require from utils for stubbing it in the tests
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
