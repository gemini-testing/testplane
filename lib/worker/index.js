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
    hermione.config.mergeWith(config);

    cb();
};

exports.runTest = (fullTitle, options, cb) => {
    hermione.runTest(fullTitle, options)
        .then(() => cb())
        .catch((err) => cb(err));
};
