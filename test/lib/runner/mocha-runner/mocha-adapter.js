'use strict';

var proxyquire = require('proxyquire').noCallThru(),
    inherit = require('inherit'),
    _ = require('lodash');

var MochaStub = inherit({
    __constructor: _.noop,
    run: _.noop,
    fullTrace: _.noop,
    addFile: _.noop,
    loadFiles: _.noop
});

describe('mocha-runner/mocha-adapter', function() {
    var sandbox = sinon.sandbox.create(),
        MochaAdapter,
        clearRequire;

    beforeEach(function() {
        clearRequire = sandbox.stub().named('clear-require');

        sandbox.stub(MochaStub.prototype);
        MochaStub.prototype.run.yields();

        MochaAdapter = proxyquire('../../../../lib/runner/mocha-runner/mocha-adapter', {
            'clear-require': clearRequire,
            'mocha': MochaStub
        });
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('addFile', function() {
        it('should add file', function() {
            var mochaAdapter = new MochaAdapter();

            mochaAdapter.addFile('path/to/file');

            assert.calledOnce(MochaStub.prototype.addFile);
            assert.calledWith(MochaStub.prototype.addFile, 'path/to/file');
        });

        it('should clear require cache for file before adding', function() {
            var mochaAdapter = new MochaAdapter();

            mochaAdapter.addFile('path/to/file');

            assert.calledWithMatch(clearRequire, 'path/to/file');
            assert.callOrder(clearRequire, MochaStub.prototype.addFile);
        });

        it('should load files after add', function() {
            var mochaAdapter = new MochaAdapter();

            mochaAdapter.addFile('path/to/file');

            assert.calledOnce(MochaStub.prototype.loadFiles);
            assert.callOrder(MochaStub.prototype.addFile, MochaStub.prototype.loadFiles);
        });

        it('should flush files after load', function() {
            var mocha = new MochaStub();
            mocha.files = ['some/file'];
            MochaStub.prototype.__constructor.returns(mocha);

            var mochaAdapter = new MochaAdapter();

            mochaAdapter.addFile('path/to/file');

            assert.deepEqual(mocha.files, []);
        });
    });
});
