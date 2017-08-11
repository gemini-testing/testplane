'use strict';

const Hermione = require('./hermione');

let hermione;

exports.init = (config, options, cb) => {
    hermione = Hermione.create(config.configPath);
    hermione.config.mergeWith(config);

    return hermione.init(options)
        .then(() => cb())
        .catch((err) => cb(err));
};

exports.runTest = (fullTitle, options, cb) => {
    hermione.runTest(fullTitle, {browserId: options.browserId, sessionId: options.sessionId})
        .then(() => cb())
        .catch((err) => cb(err));
};
