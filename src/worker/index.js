"use strict";

const TestplaneFacade = require("./testplane-facade");

const testplaneFacade = TestplaneFacade.create();
testplaneFacade.init();

exports.runTest = (fullTitle, options) => {
    return testplaneFacade.runTest(fullTitle, options);
};
