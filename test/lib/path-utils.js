'use strict';

const logger = require('../../lib/utils').logger;
const proxyquire = require('proxyquire');
const glob = sinon.stub();
const pathUtils = proxyquire('../../lib/path-utils', {
    'glob': glob
});

describe('path-utils', () => {
    it('should run tests using a mask', () => {
        pathUtils.expandPaths(['/test']);
        assert.calledWith(glob, '/test');
    });
});
