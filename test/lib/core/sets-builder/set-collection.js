'use strict';

const SetCollection = require('build/core/sets-builder/set-collection');
const TestSet = require('build/core/sets-builder/test-set');

describe('set-collection', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    it('should group set browsers by file', () => {
        const sets = {
            set1: TestSet.create({
                files: ['some/files/file1.js', 'some/common/file.js'],
                browsers: ['bro1']
            }),
            set2: TestSet.create({
                files: ['other/files/file2.js', 'some/common/file.js'],
                browsers: ['bro2']
            })
        };
        const groupedBrowsers = SetCollection
            .create(sets)
            .groupByFile();

        assert.deepEqual(groupedBrowsers, {
            'some/files/file1.js': ['bro1'],
            'other/files/file2.js': ['bro2'],
            'some/common/file.js': ['bro1', 'bro2']
        });
    });

    it('should group set files by browser', () => {
        const sets = {
            set1: TestSet.create({
                files: ['some/files/file1.js'],
                browsers: ['bro1', 'bro3']
            }),
            set2: TestSet.create({
                files: ['other/files/file2.js'],
                browsers: ['bro2', 'bro3']
            })
        };
        const groupedFiles = SetCollection
            .create(sets)
            .groupByBrowser();

        assert.deepEqual(groupedFiles, {
            'bro1': ['some/files/file1.js'],
            'bro2': ['other/files/file2.js'],
            'bro3': ['some/files/file1.js', 'other/files/file2.js']
        });
    });
});
