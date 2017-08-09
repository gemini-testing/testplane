'use strict';

const Hermione = require('./hermione');

const init = (params) => {
    const options = params.options;
    const config = params.config;

    const hermione = Hermione.create(config.configPath);

    hermione.config.mergeWith(config);

    return hermione.init(options);
};

const initedHermione = init(JSON.parse(process.argv[2]));

exports.runTest = (fullTitle, options, cb) => {
    initedHermione
        .then((hermione) => hermione.runTest(fullTitle, {browserId: options.browserId, sessionId: options.sessionId}))
        .then(() => cb())
        .catch((err) => cb(err));
};
