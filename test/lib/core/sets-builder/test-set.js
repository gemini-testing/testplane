'use strict';

const fs = require('fs');
const proxyquire = require('proxyquire');

describe('TestSet', () => {
    const sandbox = sinon.sandbox.create();
    let TestSet, globExtraStub;

    beforeEach(() => {
        globExtraStub = {
            expandPaths: sinon.stub()
        };
        TestSet = proxyquire('build/core/sets-builder/test-set', {
            'glob-extra': globExtraStub
        });
    });

    afterEach(() => sandbox.restore());

    it('should return all set files', () => {
        const set = TestSet.create({
            files: ['some/path/file.js']
        });

        assert.deepEqual(set.getFiles(), ['some/path/file.js']);
    });

    it('should return all set browsers', () => {
        const set = TestSet.create({browsers: ['bro1', 'bro2']});

        assert.deepEqual(set.getBrowsers(), ['bro1', 'bro2']);
    });

    describe('expandFiles', () => {
        beforeEach(() => {
            globExtraStub.expandPaths.resolves();
        });

        it('should expand set file paths', () => {
            const set = TestSet.create({files: ['some/path/file.js']});

            globExtraStub.expandPaths.resolves(['expanded/some/path/file.js']);

            return set.expandFiles({root: 'root'})
                .then(() => assert.deepEqual(set.getFiles(), ['expanded/some/path/file.js']));
        });

        it('should resolve passed ignore masks with project root', () => {
            const set = TestSet.create({files: ['some/path/file.js'], ignoreFiles: ['some/foo/**']});

            return set.expandFiles({root: '/root'})
                .then(() => {
                    assert.calledOnceWith(
                        globExtraStub.expandPaths,
                        sinon.match.any,
                        sinon.match.any,
                        {ignore: ['/root/some/foo/**']}
                    );
                });
        });

        it('should merge ignore masks from set with ignore from passed arguments', () => {
            const set = TestSet.create({files: ['some/path/file.js'], ignoreFiles: ['some/foo/**']});

            return set.expandFiles({root: '/root'}, {ignore: ['another/mask/**']})
                .then(() => {
                    assert.calledOnceWith(
                        globExtraStub.expandPaths,
                        sinon.match.any,
                        sinon.match.any,
                        {ignore: ['/root/another/mask/**', '/root/some/foo/**']}
                    );
                });
        });
    });

    describe('resolveFiles', () => {
        it('should resolve set files using project root', () => {
            const set = TestSet.create({files: ['some/path/file.js']});

            set.resolveFiles('/project/root');
            assert.deepEqual(set.getFiles(), ['/project/root/some/path/file.js']);
        });

        it('should not mutate constructor arguments', () => {
            const input = {files: ['some/path/file.js']};
            const set = TestSet.create(input);

            set.resolveFiles('/project/root');
            assert.deepEqual(input, {files: ['some/path/file.js']});
        });
    });

    describe('getBrowsersForFile', () => {
        it('should return all browsers for file', () => {
            const set = TestSet.create({
                files: ['some/path/file.js'],
                browsers: ['bro1', 'bro2']
            });
            const browsers = set.getBrowsersForFile('some/path/file.js');

            assert.deepEqual(browsers, ['bro1', 'bro2']);
        });

        it('should return empty array if no such file in the set', () => {
            const set = TestSet.create({
                files: ['some/path/file.js'],
                browsers: ['bro1', 'bro2']
            });
            const browsers = set.getBrowsersForFile('other/path/file1.js');

            assert.deepEqual(browsers, []);
        });
    });

    describe('getFilesForBrowser', () => {
        it('should return all files for browser', () => {
            const set = TestSet.create({
                files: ['some/path/file.js'],
                browsers: ['bro1']
            });
            const files = set.getFilesForBrowser('bro1');

            assert.deepEqual(files, ['some/path/file.js']);
        });

        it('should return empty array if no such browser in the set', () => {
            const set = TestSet.create({
                files: ['some/path/file.js'],
                browsers: ['bro1']
            });
            const files = set.getFilesForBrowser('bro2');

            assert.deepEqual(files, []);
        });
    });

    describe('useFiles', () => {
        it('should return intersection of set files and passed files', () =>{
            const set = TestSet.create({files: ['some/path/file.js']});

            set.useFiles(['some/path/file.js', 'some/path/file2.js']);

            assert.deepEqual(set.getFiles(), ['some/path/file.js']);
        });

        it('should return passed files if there are no files in a set', () => {
            const set = TestSet.create({files: []});
            set.useFiles(['some/path/file.js']);

            assert.deepEqual(set.getFiles(), ['some/path/file.js']);
        });

        it('should use set files if passed files are empty', () => {
            const set = TestSet.create({files: ['some/path/file.js']});
            set.useFiles([]);

            assert.deepEqual(set.getFiles(), ['some/path/file.js']);
        });

        it('should use passed files if set files contain masks and files', () => {
            const set = TestSet.create({files: ['some/path/*.hermione.js', 'some/path/test1.hermione.js']});
            set.useFiles(['some/path/test2.hermione.js']);

            assert.deepEqual(set.getFiles(), ['some/path/test2.hermione.js']);
        });

        it('should use matched files with masks specified in the set', () => {
            const set = TestSet.create({files: ['some/*/*.js']});

            set.useFiles(['some/path/file.js', 'another/path/file2.js']);

            assert.deepEqual(set.getFiles(), ['some/path/file.js']);
        });

        it('should not mutate constructor arguments', () => {
            const input = {files: ['some/*/*.js']};
            const set = TestSet.create(input);

            set.useFiles(['some/path/file.js', 'another/path/file2.js']);

            assert.deepEqual(input, {files: ['some/*/*.js']});
        });
    });

    describe('useBrowsers', () => {
        it('should use set browsers if browsers are not specified', () => {
            const set = TestSet.create({browsers: ['bro1']});

            set.useBrowsers();

            assert.deepEqual(set.getBrowsers(), ['bro1']);
        });

        it('should use intersection of set browsers and specified browsers', () => {
            const set = TestSet.create({browsers: ['bro1', 'bro2']});

            set.useBrowsers(['bro2', 'bro3']);

            assert.deepEqual(set.getBrowsers(), ['bro2']);
        });

        it('should not mutate constructor arguments', () => {
            const input = {browsers: ['bro1', 'bro2']};
            const set = TestSet.create(input);

            set.useBrowsers(['bro2', 'bro3']);

            assert.deepEqual(input, {browsers: ['bro1', 'bro2']});
        });
    });

    describe('transformDirsToMasks', () => {
        beforeEach(() => sandbox.stub(fs, 'stat'));

        it('should transform set paths to masks if paths are directories', () => {
            fs.stat.yields(null, {isDirectory: () => true});
            const set = TestSet.create({files: ['some/path']});

            return set.transformDirsToMasks()
                .then(() => assert.deepEqual(set.getFiles(), ['some/path/**']));
        });

        it('should not mutate constructor arguments', () => {
            fs.stat.yields(null, {isDirectory: () => true});
            const input = {files: ['some/path']};
            const set = TestSet.create(input);

            return set.transformDirsToMasks()
                .then(() => assert.deepEqual(input, {files: ['some/path']}));
        });

        it('should not transform set paths to masks if paths are already masks', () => {
            const set = TestSet.create({files: ['some/path/*.js']});

            return set.transformDirsToMasks()
                .then(() => assert.deepEqual(set.getFiles(), ['some/path/*.js']));
        });

        it('should not transform set paths to masks if paths are files', () => {
            fs.stat.yields(null, {isDirectory: () => false});
            const set = TestSet.create({files: ['some/path/file.js']});

            return set.transformDirsToMasks()
                .then(() => assert.deepEqual(set.getFiles(), ['some/path/file.js']));
        });

        it('should throw an error if passed path does not exist', () => {
            fs.stat.throws(new Error);

            const set = TestSet.create({files: ['some/error/file.js']});

            return assert.isRejected(set.transformDirsToMasks(), /Cannot read such file or directory: 'some\/error\/file.js'/)
                .then(() => assert.deepEqual(set.getFiles(), ['some/error/file.js']));
        });
    });
});
