'use strict';

const Skip = require('../../../../../lib/runner/mocha-runner/skip/');
const SkipBuilder = require('../../../../../lib/runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('../../../../../lib/runner/mocha-runner/skip/only-builder');

describe('OnlyBuilder', () => {
    const sandbox = sinon.sandbox.create();

    let skipBuilder;

    beforeEach(() => {
        const skip = new Skip();
        skipBuilder = new SkipBuilder(skip, 'browserId');

        sandbox.stub(skipBuilder, 'notIn');
    });

    it('should call skipBuilder.notIn', () => {
        const onlyBuilder = new OnlyBuilder(skipBuilder);

        onlyBuilder.in();

        assert.calledOnce(skipBuilder.notIn);
    });

    it('should call skipBuilder.notIn with option silent by default', () => {
        const onlyBuilder = new OnlyBuilder(skipBuilder);

        onlyBuilder.in();

        assert.calledWithMatch(skipBuilder.notIn, sinon.match.any, sinon.match.any, {silent: true});
    });

    it('should pass arguments to skipBuilder.notIn', () => {
        const onlyBuilder = new OnlyBuilder(skipBuilder);

        onlyBuilder.in('browserId');

        assert.calledWith(skipBuilder.notIn, 'browserId');
    });
});
