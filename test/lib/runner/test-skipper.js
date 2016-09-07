'use strict';

const TestSkipper = require('../../../lib/runner/test-skipper');
const logger = require('../../../lib/utils').logger;

describe('test-skipper', () => {
    const sandbox = sinon.sandbox.create();

    const mkTestSkipper = (config) => new TestSkipper(config || {});

    beforeEach(() => {
        sandbox.stub(logger, 'warn');
    });

    afterEach(() => {
        delete process.env.HERMIONE_SKIP_BROWSERS;

        sandbox.restore();
    });

    it('should not skip browsers if HERMIONE_SKIP_BROWSERS environment variable is not specified', () => {
        const testSkipper = mkTestSkipper();
        const suite = {pending: false};

        testSkipper.applySkip(suite, 'b1');

        assert.isFalse(suite.pending);
    });

    it('should skip browsers from HERMIONE_SKIP_BROWSERS environment variable', () => {
        process.env.HERMIONE_SKIP_BROWSERS = 'b1';

        const testSkipper = mkTestSkipper({browsers: {b1: {}, b2:{}}});
        const suite = {pending: false};

        testSkipper.applySkip(suite, 'b1');

        assert.isTrue(suite.pending);
        assert.match(suite.skipReason, 'HERMIONE_SKIP_BROWSERS');
    });

    it('should not skip browsers which are not in the environment variable', () => {
        process.env.HERMIONE_SKIP_BROWSERS = 'b1';

        const testSkipper = mkTestSkipper({browsers: {b1: {}, b2:{}}});
        const suite = {pending: false};

        testSkipper.applySkip(suite, 'b2');

        assert.isFalse(suite.pending);
    });

    it('should correctly split the environment variable', () => {
        process.env.HERMIONE_SKIP_BROWSERS = 'b1,b2';

        const testSkipper = mkTestSkipper({browsers: {b1: {}, b2:{}}});
        const suite1 = {pending: false};
        const suite2 = {pending: false};

        testSkipper.applySkip(suite1, 'b1');
        testSkipper.applySkip(suite2, 'b2');

        assert.isTrue(suite1.pending);
        assert.isTrue(suite2.pending);
    });

    it('should correctly split the environment variable which contains spaces', () => {
        process.env.HERMIONE_SKIP_BROWSERS = 'b1, b2';

        const testSkipper = mkTestSkipper({browsers: {b1: {}, b2:{}}});
        const suite1 = {pending: false};
        const suite2 = {pending: false};

        testSkipper.applySkip(suite1, 'b1');
        testSkipper.applySkip(suite2, 'b2');

        assert.isTrue(suite1.pending);
        assert.isTrue(suite2.pending);
    });

    it('should warn about unknown browsers in the environment variable', () => {
        process.env.HERMIONE_SKIP_BROWSERS = 'b3';

        mkTestSkipper({browsers: {b1: {}, b2:{}}});

        assert.calledWith(logger.warn, sinon.match(/Unknown browser ids: b3(.+) specified in the config file: b1, b2/));
    });
});
