'use strict';

const nodeTemp = require('temp');
const {requireWithNoCache} = require('build/core/utils');

describe('temp', () => {
    const sandbox = sinon.sandbox.create();
    let temp;

    beforeEach(() => {
        sandbox.stub(nodeTemp);
        temp = requireWithNoCache(require.resolve('build/core/temp'));
    });

    afterEach(() => sandbox.restore());

    it('should enable auto clean', () => {
        assert.calledOnce(nodeTemp.track);
    });

    describe('init', () => {
        it('should create screenshots temp dir in system temp dir by default', () => {
            temp.init();

            assert.calledWithMatch(nodeTemp.mkdirSync, {
                dir: sinon.match.falsy,
                prefix: '.screenshots.tmp.'
            });
        });

        it('should create screenshots temp dir in passed dir', () => {
            temp.init('./');

            assert.calledWith(nodeTemp.mkdirSync, {
                dir: process.cwd(),
                prefix: '.screenshots.tmp.'
            });
        });

        it('should create screenshots temp dir in passed absolute path', () => {
            temp.init('/some/dir');

            assert.calledWithMatch(nodeTemp.mkdirSync, {
                dir: '/some/dir'
            });
        });
    });

    describe('path', () => {
        it('should passthrough options extending them with temp dir', () => {
            nodeTemp.mkdirSync.returns('/some/temp/dir');
            temp.init();

            temp.path({prefix: 'prefix.', suffix: '.suffix'});

            assert.calledWith(nodeTemp.path, {
                dir: '/some/temp/dir',
                prefix: 'prefix.',
                suffix: '.suffix'
            });
        });
    });
});
