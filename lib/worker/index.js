'use strict';

const HermioneFacade = require('./hermione-facade');

const hermioneFacade = HermioneFacade.create();
hermioneFacade.init();

exports.runTest = (fullTitle, options) => {
    return hermioneFacade.runTest(fullTitle, options);
};
