'use strict';

const proxyquire = require('proxyquire');

describe('path-utils', () => {
    let sandbox = sinon.sandbox.create();
    let glob;
    let pathUtils;

    beforeEach(() => {
        glob = sandbox.stub();
        pathUtils = proxyquire('../../lib/path-utils', {
            'glob': glob
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should run tests using a mask', () => {
        pathUtils.expandPaths(['/test']);
        assert.calledWith(glob, '/test');
    });
});
