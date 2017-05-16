'use strict';

const _ = require('lodash');
const MochaBuilder = require('../../../../lib/runner/mocha-runner/mocha-builder');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const RunnerEvents = require('../../../../lib/constants/runner-events');
const TestStub = require('../../_mocha').Test;

describe('mocha-runner/mocha-builder', () => {
    const sandbox = sinon.sandbox.create();

    const mkMochaAdapterStub_ = () => {
        // We can't call constructor because it creates mocha instance inside
        const mochaAdapter = Object.create(MochaAdapter.prototype);

        mochaAdapter.suite = {tests: []};
        mochaAdapter.tests = [];

        return _.extend(mochaAdapter, {suite: {tests: []}});
    };
    const buildAdapters_ = (paths, opts) => MochaBuilder.create({}).buildAdapters(paths, opts ? opts.limit : Infinity);

    beforeEach(() => {
        sandbox.stub(MochaAdapter.prototype, 'attachTestFilter').callsFake(function() {
            return this;
        });
        sandbox.stub(MochaAdapter.prototype, 'applySkip').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'loadFile').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'run');
    });

    afterEach(() => sandbox.restore());

    describe('buildAdapters', () => {
        const stubTest = (options) => {
            options = _.isString(options) ? {title: options} : options;

            return new TestStub(null, options);
        };

        const stubTestFiles = (files) => {
            let filterFn;
            MochaAdapter.prototype.attachTestFilter.callsFake(function(fn) {
                filterFn = fn;
                return this;
            });

            _.forEach(files, (tests, file) => {
                MochaAdapter.prototype.loadFile
                    .withArgs(file).callsFake(function() {
                        tests.forEach((test, index) => {
                            test.file = file;
                            filterFn(test, index) && this.tests.push(test) && this.suite.tests.push(test);
                        });

                        return this;
                    });
            });
        };

        beforeEach(() => {
            sandbox.stub(MochaAdapter, 'create').callsFake(() => mkMochaAdapterStub_());
        });

        describe('should build mocha adapters ', () => {
            const assertTests = (mocha, titles) => assert.deepEqual(_.map(mocha.suite.tests, 'title'), titles);

            it('when the total number of tests equals to the limit', () => {
                stubTestFiles({
                    'first/file': [stubTest('test 1')],
                    'second/file': [stubTest('test 2')]
                });

                const mochas = buildAdapters_(['first/file', 'second/file'], {limit: 2});

                assert.lengthOf(mochas, 1);
                assertTests(mochas[0], ['test 1', 'test 2']);
            });

            it('when the total number of tests is less than the limit', () => {
                stubTestFiles({
                    'first/file': [stubTest('test 1')],
                    'second/file': [stubTest('test 2')]
                });

                const mochas = buildAdapters_(['first/file', 'second/file'], {limit: 3});

                assert.lengthOf(mochas, 1);
                assertTests(mochas[0], ['test 1', 'test 2']);
            });

            it('when number of tests in each file equals to the limit', () => {
                stubTestFiles({
                    'first/file': [stubTest('test 1')],
                    'second/file': [stubTest('test 2')]
                });

                const mochas = buildAdapters_(['first/file', 'second/file'], {limit: 1});

                assert.lengthOf(mochas, 2);
                assertTests(mochas[0], ['test 1']);
                assertTests(mochas[1], ['test 2']);
            });

            it('when number of tests in a file is greater than the limit', () => {
                stubTestFiles({
                    'some/file': [stubTest('test 1'), stubTest('test 2')]
                });

                const mochas = buildAdapters_(['some/file'], {limit: 1});

                assert.lengthOf(mochas, 2);
                assertTests(mochas[0], ['test 1']);
                assertTests(mochas[1], ['test 2']);
            });

            it('when number of tests in some file is not divisible by the limit', () => {
                stubTestFiles({
                    'first/file': [stubTest('test 1'), stubTest('test 2'), stubTest('test 3')],
                    'second/file': [stubTest('test 4')]
                });

                const mochas = buildAdapters_(['first/file', 'second/file'], {limit: 2});

                assert.lengthOf(mochas, 2);
                assertTests(mochas[0], ['test 1', 'test 2']);
                assertTests(mochas[1], ['test 3', 'test 4']);
            });

            it('when files do not contain any tests', () => {
                stubTestFiles({
                    'some/file': []
                });

                const mochas = buildAdapters_(['some/file']);

                assert.lengthOf(mochas, 0);
            });

            it('when files have pending tests', () => {
                stubTestFiles({
                    'some/file': [
                        stubTest('test 1'),
                        stubTest({title: 'test 2', pending: true}),
                        stubTest('test 3'),
                        stubTest({title: 'test 4', pending: true})
                    ]
                });

                const mochas = buildAdapters_(['some/file'], {limit: 2});

                assert.lengthOf(mochas, 2);
                assertTests(mochas[0], ['test 1', 'test 2', 'test 3']);
                assertTests(mochas[1], ['test 4']);
            });
        });

        it('should pass mocha opts to mocha adapter', () => {
            const mochaBuilder = MochaBuilder.create({mochaOpts: {foo: 'bar'}});

            mochaBuilder.buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.create, {foo: 'bar'});
        });

        it('should share single opts object between all mocha instances', () => {
            stubTestFiles({
                'some/file': [stubTest()],
                'another/file': [stubTest()]
            });

            const limit = 1;
            MochaBuilder
                .create({mochaOpts: {foo: 'bar'}})
                .buildAdapters(['some/file', 'another/file'], limit);

            assert.strictEqual(
                MochaAdapter.create.firstCall.args[0],
                MochaAdapter.create.secondCall.args[0]
            );
        });

        it('should pass browser agent to mocha adapter', () => {
            stubTestFiles({
                'some/file': [stubTest()]
            });

            const mochaBuilder = MochaBuilder.create({}, {browserId: 'bro'});

            mochaBuilder.buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.create, sinon.match.any, {browserId: 'bro'});
        });

        it('should pass ctx to mocha adapter', () => {
            stubTestFiles({
                'some/file': [stubTest()]
            });

            const mochaBuilder = MochaBuilder.create({ctx: {foo: 'bar'}});

            mochaBuilder.buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.create, sinon.match.any, sinon.match.any, {foo: 'bar'});
        });

        it('should share ctx from config between all mocha instances', () => {
            stubTestFiles({
                'some/file': [stubTest()],
                'another/file': [stubTest()]
            });

            const limit = 1;
            MochaBuilder
                .create({ctx: {foo: 'bar'}})
                .buildAdapters(['some/file', 'another/file'], limit);

            assert.strictEqual(
                MochaAdapter.create.firstCall.args[2],
                MochaAdapter.create.secondCall.args[2]
            );
        });

        it('should skip test using test skipper', () => {
            stubTestFiles({
                'some/file': [stubTest()]
            });

            const testSkipper = {foo: 'bar'};

            MochaBuilder
                .create({}, {}, testSkipper)
                .buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.prototype.applySkip, testSkipper);
        });

        it('should skip test before file adding', () => {
            stubTestFiles({
                'some/file': [stubTest()]
            });

            buildAdapters_(['some/file']);

            assert.callOrder(
                MochaAdapter.prototype.applySkip,
                MochaAdapter.prototype.loadFile
            );
        });

        describe('should passthrough events from a mocha instance', () => {
            const events = [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ];

            events.forEach((event) => {
                it(`${event}`, () => {
                    const mochaAdapter = mkMochaAdapterStub_();
                    MochaAdapter.create.returns(mochaAdapter);

                    MochaAdapter.prototype.loadFile.onFirstCall().callsFake(function() {
                        mochaAdapter.emit(event, 'some-data');
                        return this;
                    });

                    const mochaBuilder = MochaBuilder.create({});
                    const spy = sinon.spy();

                    mochaBuilder.on(event, spy);
                    mochaBuilder.buildAdapters(['some/file']);

                    assert.calledOnce(spy);
                    assert.calledWith(spy, 'some-data');
                });
            });
        });
    });
});
