'use strict';

const q = require('q');
const Hermione = require('./hermione');

let hermione;

exports.init = function(testFiles, configPath, cb) {
    hermione = Hermione.create(configPath);

    q()
        .then(() => hermione.init(testFiles))
        .then(() => cb())
        .catch((err) => cb(err));
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
