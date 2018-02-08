'use strict';

const HermioneFacade = require('./hermione-facade');

const hermioneFacade = HermioneFacade.create();
hermioneFacade.init();

exports.runTest = (fullTitle, options, cb) => {
    hermioneFacade.runTest(fullTitle, options)
        .then((data) => cb(null, data))
        .catch((err) => cb(err));
};
