'use strict';

const TestCollection = require('lib/test-collection');

describe('test-collection', () => {
    describe('getBrowsers', () => {
        it('should return browsers from passed specs', () => {
            const collection = TestCollection.create({
                'bro1': [],
                'bro2': []
            });

            const browsers = collection.getBrowsers();

            assert.deepEqual(browsers, ['bro1', 'bro2']);
        });
    });

    describe('mapTests', () => {
        it('should map over tests for passed browser', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};

            const collection = TestCollection.create({
                'bro1': [test1],
                'bro2': [test2, test3]
            });

            const tests = collection.mapTests('bro2', (test, browser) => ({test, browser}));

            assert.deepEqual(
                tests,
                [
                    {test: test2, browser: 'bro2'},
                    {test: test3, browser: 'bro2'}
                ]
            );
        });

        it('should map over all tests for all if browser not specified', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};

            const collection = TestCollection.create({
                'bro1': [test1],
                'bro2': [test2, test3]
            });

            const tests = collection.mapTests((test, browser) => ({test, browser}));

            assert.deepEqual(
                tests,
                [
                    {test: test1, browser: 'bro1'},
                    {test: test2, browser: 'bro2'},
                    {test: test3, browser: 'bro2'}
                ]
            );
        });
    });

    describe('eachTest', () => {
        it('should iterate over tests for passed browser', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};

            const collection = TestCollection.create({
                'bro1': [test1],
                'bro2': [test2, test3]
            });

            const tests = [];
            collection.eachTest('bro2', (test, browser) => tests.push({test, browser}));

            assert.deepEqual(
                tests,
                [
                    {test: test2, browser: 'bro2'},
                    {test: test3, browser: 'bro2'}
                ]
            );
        });

        it('should iterate over all tests for all if browser not specified', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};

            const collection = TestCollection.create({
                'bro1': [test1],
                'bro2': [test2, test3]
            });

            const tests = [];
            collection.eachTest((test, browser) => tests.push({test, browser}));

            assert.deepEqual(
                tests,
                [
                    {test: test1, browser: 'bro1'},
                    {test: test2, browser: 'bro2'},
                    {test: test3, browser: 'bro2'}
                ]
            );
        });
    });
});
