'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const globExtra = require('glob-extra');
const SetsBuilder = require('gemini-core').SetsBuilder;
const sets = require('../../lib/sets');

describe('sets', () => {
    const sandbox = sinon.sandbox.create();

    let setCollection = {groupByBrowser: sandbox.stub()};
    let createSetsBuilder;

    const revealSets_ = (opts) => {
        opts = _.defaults(opts || {}, {
            paths: [],
            config: {},
            sets: {}
        });

        return sets.reveal(opts.config.sets, opts);
    };

    const mkConfigStub = (opts) => {
        opts = opts || {};

        return _.defaultsDeep(opts, {
            system: {
                projectRoot: '/root'
            }
        });
    };

    beforeEach(() => {
        sandbox.stub(globExtra, 'expandPaths').returns(Promise.resolve([]));
        sandbox.stub(SetsBuilder.prototype, 'useFiles').returnsThis();
        sandbox.stub(SetsBuilder.prototype, 'useSets').returnsThis();
        sandbox.stub(SetsBuilder.prototype, 'useBrowsers').returnsThis();

        sandbox.stub(SetsBuilder.prototype, 'build').returns(Promise.resolve(setCollection));
    });

    afterEach(() => sandbox.restore());

    describe('reveal', () => {
        it('should create set-builder with sets from config and default directory', () => {
            const defaultDir = require('../../package').name;
            const opts = {
                config: mkConfigStub({
                    sets: {
                        all: {}
                    }
                })
            };
            createSetsBuilder = sandbox.spy(SetsBuilder, 'create');

            return revealSets_(opts)
                .then(() => {
                    assert.calledOnce(createSetsBuilder);
                    assert.calledWithMatch(createSetsBuilder, {all: {}}, {defaultDir});
                });
        });

        it('should use passed paths from cli', () => {
            return revealSets_({paths: ['some/path']})
                .then(() => {
                    assert.calledOnce(SetsBuilder.prototype.useFiles);
                    assert.calledWith(SetsBuilder.prototype.useFiles, ['some/path']);
                });
        });

        it('should use pased sets from cli', () => {
            return revealSets_({sets: ['set1']})
                .then(() => {
                    assert.calledOnce(SetsBuilder.prototype.useSets);
                    assert.calledWith(SetsBuilder.prototype.useSets, ['set1']);
                });
        });

        it('should use pased browsers from cli', () => {
            return revealSets_({browsers: ['bro1']})
                .then(() => {
                    assert.calledOnce(SetsBuilder.prototype.useBrowsers);
                    assert.calledWith(SetsBuilder.prototype.useBrowsers, ['bro1']);
                });
        });

        it('should build set-collection using project directory', () => {
            return revealSets_({sets: ['set1']})
                .then(() => {
                    assert.calledOnce(SetsBuilder.prototype.build);
                    assert.calledWithMatch(SetsBuilder.prototype.build, 'hermione');
                });
        });

        it('should group files by browser', () => {
            setCollection.groupByBrowser.returns({bro1: ['some/path/file.js']});

            return revealSets_()
                .then((result) => assert.deepEqual(result, {bro1: ['some/path/file.js']}));
        });

        it('should call set-builder methods in rigth order', () => {
            return revealSets_()
                .then(() => {
                    assert.callOrder(
                        createSetsBuilder,
                        SetsBuilder.prototype.useSets,
                        SetsBuilder.prototype.useFiles,
                        SetsBuilder.prototype.useBrowsers,
                        SetsBuilder.prototype.build
                    );
                });
        });
    });
});
