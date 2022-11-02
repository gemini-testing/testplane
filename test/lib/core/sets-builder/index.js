'use strict';

const Promise = require('bluebird');
const globExtra = require('glob-extra');
const fs = require('fs');
const SetBuilder = require('lib/core/sets-builder');
const SetCollection = require('lib/core/sets-builder/set-collection');
const TestSet = require('lib/core/sets-builder/test-set');

describe('sets-builder', () => {
    const sandbox = sinon.sandbox.create();
    const setCollection = sinon.createStubInstance(SetCollection);

    const createSetBuilder = (sets, opts) => SetBuilder.create(sets || {all: {files: ['some/path']}}, opts || {});

    beforeEach(() => {
        sandbox.stub(SetCollection, 'create').returns(Promise.resolve());
        sandbox.stub(globExtra, 'expandPaths').returns(Promise.resolve([]));
        sandbox.stub(TestSet.prototype, 'resolveFiles');
        sandbox.stub(fs, 'stat').yields(null, {isDirectory: () => false});
    });

    afterEach(() => sandbox.restore());

    describe('build', () => {
        it('should create set collection for all sets if sets to use are not specified', () => {
            globExtra.expandPaths
                .withArgs(['some/files']).returns(Promise.resolve(['some/files/file1.js']))
                .withArgs(['other/files']).returns(Promise.resolve(['other/files/file2.js']));

            const sets = {
                set1: {files: ['some/files']},
                set2: {files: ['other/files']}
            };
            const setStub1 = TestSet.create({files: ['some/files/file1.js']});
            const setStub2 = TestSet.create({files: ['other/files/file2.js']});

            return createSetBuilder(sets)
                .build()
                .then(() => {
                    assert.calledOnce(SetCollection.create);
                    assert.calledWith(SetCollection.create, {set1: setStub1, set2: setStub2});
                });
        });

        it('should return set collection', () => {
            SetCollection.create.returns(setCollection);

            return createSetBuilder()
                .build()
                .then((result) => assert.deepEqual(result, setCollection));
        });

        it('should expand files from sets using passed glob options and project root', () => {
            const expandSetFiles = sandbox.spy(TestSet.prototype, 'expandFiles');
            const sets = {
                all: {files: ['some/files']}
            };
            const globOpts = {glob: 'opts'};

            return createSetBuilder(sets)
                .build('/root', globOpts)
                .then(() => {
                    assert.calledOnce(expandSetFiles);
                    assert.calledWith(expandSetFiles, {formats: ['.js', '.mjs'], root: '/root'}, {glob: 'opts'});
                });
        });

        it('should expand files from sets using passed file extensions', () => {
            const expandSetFiles = sandbox.spy(TestSet.prototype, 'expandFiles');

            return createSetBuilder()
                .build('/root', {}, ['.foo', '.bar'])
                .then(() => {
                    assert.calledOnceWith(expandSetFiles, sinon.match({formats: ['.foo', '.bar']}), sinon.match.any);
                });
        });

        it('should use default directory', () => {
            sandbox.stub(TestSet.prototype, 'expandFiles');
            globExtra.expandPaths.withArgs(['project/path']).returns(Promise.resolve(['project/path']));

            const setStub = TestSet.create({files: ['project/path']});

            SetCollection.create.withArgs({default: setStub}).returns(setCollection);

            return createSetBuilder({default: {files: []}}, {defaultDir: 'project/path'})
                .build()
                .then((result) => {
                    assert.calledWith(globExtra.expandPaths, ['project/path']);
                    assert.deepEqual(result, setCollection);
                });
        });

        it('should resolve files by project root for each set', () => {
            return createSetBuilder({default: {files: ['some/path']}})
                .build('project/root')
                .then(() => {
                    assert.calledOnce(TestSet.prototype.resolveFiles);
                    assert.calledWith(TestSet.prototype.resolveFiles, 'project/root');
                });
        });

        describe('should resolve glob ignore patterns by project root if pattern set as', () => {
            beforeEach(() => sandbox.stub(TestSet.prototype, 'expandFiles'));

            it('string', () => {
                const globOpts = {ignore: 'exclude/files'};

                return createSetBuilder()
                    .build('/root', globOpts)
                    .then(() => {
                        assert.calledOnce(TestSet.prototype.expandFiles);
                        assert.calledWith(
                            TestSet.prototype.expandFiles,
                            sinon.match.any,
                            {ignore: ['/root/exclude/files']}
                        );
                    });
            });

            it('array of strings', () => {
                const globOpts = {ignore: ['exclude/files', 'exclude/*.js']};

                return createSetBuilder()
                    .build('/root', globOpts)
                    .then(() => {
                        assert.calledOnce(TestSet.prototype.expandFiles);
                        assert.calledWith(
                            TestSet.prototype.expandFiles,
                            sinon.match.any,
                            {ignore: ['/root/exclude/files', '/root/exclude/*.js']}
                        );
                    });
            });
        });
    });

    describe('useSets', () => {
        it('should be chainable', () => {
            assert.instanceOf(createSetBuilder().useSets(), SetBuilder);
        });

        it('should create set collection for specified sets', () => {
            globExtra.expandPaths.withArgs(['some/files']).returns(Promise.resolve(['some/files/file.js']));

            const sets = {
                set1: {files: ['some/files']},
                set2: {files: ['other/files']}
            };
            const setStub = TestSet.create({files: ['some/files/file.js']});

            return createSetBuilder(sets)
                .useSets(['set1'])
                .build()
                .then(() => {
                    assert.calledOnce(SetCollection.create);
                    assert.calledWith(SetCollection.create, {set1: setStub});
                });
        });

        it('should validate unknown sets', () => {
            const sets = {
                set1: {}
            };

            assert.throws(() => createSetBuilder(sets).useSets(['set2']), /No such sets: set2. Use one of the specified sets: set1/);
        });
    });

    describe('useFiles', () => {
        beforeEach(() => sandbox.stub(TestSet.prototype, 'expandFiles'));

        it('should be chainable', () => {
            assert.instanceOf(createSetBuilder().useFiles(), SetBuilder);
        });

        it('should throw an error if sets do not contain paths from opts', () => {
            globExtra.expandPaths.withArgs(['other/files']).returns(Promise.resolve(['other/files/file.js']));

            const sets = {
                all: {files: ['some/files']}
            };

            return assert.isRejected(createSetBuilder(sets)
                .useFiles(['other/files'])
                .build()
            );
        });

        it('should use set files if paths are nor passed', () => {
            const sets = {
                all: {files: ['some/files']}
            };
            const setStub = TestSet.create({files: ['some/files']});

            SetCollection.create.withArgs({all: setStub}).returns(setCollection);

            return createSetBuilder(sets)
                .useFiles([])
                .build()
                .then((result) => assert.deepEqual(result, setCollection));
        });

        it('should expand passed files with passed glob options', () => {
            const globOpts = sandbox.stub();
            sandbox.stub(TestSet.prototype, 'useFiles');
            globExtra.expandPaths.withArgs(['some/files']).resolves(['some/files/file.js']);

            return createSetBuilder()
                .useFiles(['some/files'])
                .build('', globOpts)
                .then(() => {
                    assert.calledOnce(globExtra.expandPaths);
                    assert.calledWith(globExtra.expandPaths, ['some/files'], sinon.match({formats: ['.js', '.mjs']}), globOpts);
                });
        });

        it('should throw an error if no files were found with specified paths', () => {
            globExtra.expandPaths.withArgs(['some/files']).resolves([]);

            return assert.isRejected(
                createSetBuilder().useFiles(['some/files', 'another/files']).build(),
                /Cannot find files by specified paths: some\/files, another\/files/
            );
        });

        it('should apply files to all sets if sets are specified', () => {
            sandbox.stub(TestSet.prototype, 'useFiles');
            globExtra.expandPaths.withArgs(['some/files']).resolves(['some/files/file.js']);

            const sets = {
                all: {files: ['some/files']}
            };

            return createSetBuilder(sets)
                .useFiles(['some/files'])
                .build()
                .then(() => {
                    assert.calledOnce(TestSet.prototype.useFiles);
                    assert.calledWith(TestSet.prototype.useFiles, ['some/files/file.js']);
                });
        });

        it('should use default directory if sets are not specified and paths are not passed', () => {
            globExtra.expandPaths.withArgs(['project/path']).returns(Promise.resolve(['project/path']));

            const setStub = TestSet.create({files: ['project/path']});

            SetCollection.create.withArgs({default: setStub}).returns(setCollection);

            return createSetBuilder({default: {files: []}}, {defaultDir: 'project/path'})
                .useFiles([])
                .build()
                .then((result) => {
                    assert.calledWith(globExtra.expandPaths, ['project/path']);
                    assert.deepEqual(result, setCollection);
                });
        });
    });

    describe('useBrowsers', () => {
        beforeEach(() => sandbox.stub(TestSet.prototype, 'useBrowsers'));

        it('should be chainable', () => {
            assert.instanceOf(createSetBuilder().useBrowsers(), SetBuilder);
        });

        it('should use passed browsers in sets', () => {
            return createSetBuilder()
                .useBrowsers(['bro1'])
                .build()
                .then(() => {
                    assert.calledOnce(TestSet.prototype.useBrowsers);
                    assert.calledWith(TestSet.prototype.useBrowsers, ['bro1']);
                });
        });
    });
});
