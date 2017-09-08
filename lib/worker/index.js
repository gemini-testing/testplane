'use strict';

const Hermione = require('./hermione');

let hermione;

exports.init = (testFiles, configPath, cb) => {
    try {
        hermione = Hermione.create(configPath);

        hermione.init(testFiles);
        cb();
    } catch (err) {
        cb(err);
    }
};

exports.syncConfig = (config, cb) => {
    delete config.system.mochaOpts.grep;  // grep affects only master

    hermione.config.mergeWith(config);

    cb();
};

exports.runTest = (fullTitle, options, cb) => {
    hermione.runTest(fullTitle, options)
        .then((data) => cb(null, data))
        .catch((err) => cb(err));
};
