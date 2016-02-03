'use strict';

var Matcher = require('../../../lib/retry-manager/matcher'),
    makeTestStub = require('./utils').makeTestStub;

describe('retry-manager/matcher', function() {
    it('should return test source file', function() {
        var someTest = makeTestStub({file: '/path/to/file'}),
            matcher = new Matcher(someTest);

        assert.equal(matcher.file, '/path/to/file');
    });

    it('should save passed browser', function() {
        var matcher = new Matcher(makeTestStub(), 'some-browser');

        assert.equal(matcher.browser, 'some-browser');
    });

    describe('test', function() {
        function test_(reference, subject) {
            var referenceTest = makeTestStub({file: reference.file}),
                subjectTest = makeTestStub({file: subject.file});

            referenceTest.fullTitle.returns(reference.fullTitle);
            subjectTest.fullTitle.returns(subject.fullTitle);

            var matcher = new Matcher(referenceTest, reference.browser);

            return matcher.test(subjectTest, subject.browser);
        }

        it('should accept: same file, same fullTitle, same browser', function() {
            assert.isTrue(test_(
                {file: '/path/to/file', fullTitle: 'some test', browser: 'some-browser'},
                {file: '/path/to/file', fullTitle: 'some test', browser: 'some-browser'}
            ));
        });

        it('should reject: same file, same fullTitle, different browsers', function() {
            assert.isFalse(test_(
                {file: '/path/to/file', fullTitle: 'some test', browser: 'some-browser'},
                {file: '/path/to/file', fullTitle: 'some test', browser: 'other-browser'}
            ));
        });

        it('should reject: same file, different fullTitle, same browsers', function() {
            assert.isFalse(test_(
                {file: '/path/to/file', fullTitle: 'some test', browser: 'some-browser'},
                {file: '/path/to/file', fullTitle: 'other test', browser: 'some-browser'}
            ));
        });

        it('should reject: different files, same fullTitle, same browsers', function() {
            assert.isFalse(test_(
                {file: '/path/to/file', fullTitle: 'some test', browser: 'some-browser'},
                {file: '/path/to/other/file', fullTitle: 'some test', browser: 'some-browser'}
            ));
        });
    });
});
