'use strict';

var _ = require('lodash'),
    utils = require('../../utils');

utils.makeTestStub = function(props) {
    return _.defaults(props || {}, {
        type: 'test',
        title: 'default-test-title',
        browserId: 'default-browser',
        fullTitle: sinon.stub().named('test.fullTitle')
    });
};

utils.makeSuiteStub = function(props) {
    return _.defaults(props || {}, {
        title: 'default-suite-title',
        suites: [],
        tests: []
    });
};

module.exports = utils;
