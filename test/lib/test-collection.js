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

            const tests = collection.mapTests('bro2', (t) => t);

            assert.deepEqual(tests, [test2, test3]);
        });
    });
});
