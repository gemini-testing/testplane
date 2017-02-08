'use strict';

const Skip = require('../../../../../lib/runner/mocha-runner/skip/');
const SkipBuilder = require('../../../../../lib/runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('../../../../../lib/runner/mocha-runner/skip/only-builder');

describe('OnlyBuilder', () => {
    const sandbox = sinon.sandbox.create();

    let skipBuilder;

    beforeEach(() => {
        skipBuilder = new SkipBuilder(new Skip(), 'browserId');
    });

    describe('.in', () => {
        beforeEach(() => {
            sandbox.stub(skipBuilder, 'notIn');
        });

        it('should call "skipBuilder.notIn"', () => {
            const onlyBuilder = new OnlyBuilder(skipBuilder);

            onlyBuilder.in();

            assert.calledOnce(skipBuilder.notIn);
        });

        it('should call "skipBuilder.notIn" with option silent by default', () => {
            const onlyBuilder = new OnlyBuilder(skipBuilder);

            onlyBuilder.in();

            assert.calledWithMatch(skipBuilder.notIn, sinon.match.any, sinon.match.any, {silent: true});
        });

        it('should pass matcher to "skipBuilder.notIn"', () => {
            const onlyBuilder = new OnlyBuilder(skipBuilder);

            onlyBuilder.in('browserId');

            assert.calledWith(skipBuilder.notIn, 'browserId');
        });
    });

    describe('.notIn', () => {
        beforeEach(() => {
            sandbox.stub(skipBuilder, 'in');
        });

        it('should call "skipBuilder.in"', () => {
            const onlyBuilder = new OnlyBuilder(skipBuilder);

            onlyBuilder.notIn();

            assert.calledOnce(skipBuilder.in);
        });

        it('should call "skipBuilder.in" with option silent by default', () => {
            const onlyBuilder = new OnlyBuilder(skipBuilder);

            onlyBuilder.notIn();

            assert.calledWithMatch(skipBuilder.in, sinon.match.any, sinon.match.any, {silent: true});
        });

        it('should pass matcher to "skipBuilder.in"', () => {
            const onlyBuilder = new OnlyBuilder(skipBuilder);

            onlyBuilder.notIn('browserId');

            assert.calledWith(skipBuilder.in, 'browserId');
        });
    });
});
