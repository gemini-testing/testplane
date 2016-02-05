'use strict';

var proxyquire = require('proxyquire').noCallThru(),
    inherit = require('inherit');

var MochaStub = inherit({
    run: sinon.stub().named('run'),
    fullTrace: sinon.stub().named('fullTrace'),
    addFile: sinon.stub().named('addFile')
});

describe('mocha-runner/mocha-adapter', function() {
    var sandbox = sinon.sandbox.create(),
        MochaAdapter,
        clearRequire;

    beforeEach(function() {
        clearRequire = sandbox.stub().named('clear-require');

        MochaStub.prototype.run.yields();

        MochaAdapter = proxyquire('../../../../lib/runner/mocha-runner/mocha-adapter', {
            'clear-require': clearRequire,
            'mocha': MochaStub
        });
    });

    describe('run', function() {
        it('should clear require cache for test file', function() {
            var mochaAdapter = new MochaAdapter();

            mochaAdapter.addFile('path/to/test');

            return mochaAdapter.run()
                .then(function() {
                    assert.calledWithMatch(clearRequire, 'path/to/test');
                });
        });
    });
});
