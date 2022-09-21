'use strict';

const {EventEmitter} = require('events');
const TestParserAPI = require('build/test-reader/test-parser-api');
const ParserEvents = require('build/test-reader/parser-events');
const RunnerEvents = require('build/constants/runner-events');
const {makeSuite, makeTest} = require('../../utils');

describe('test-reader/test-parser-api', () => {
    const mkTestParser_ = () => {
        return new EventEmitter();
    };

    describe('setController', () => {
        it('should set appropriate controller to context', () => {
            const hermione = {};
            const parserAPI = TestParserAPI.create(mkTestParser_(), hermione);

            parserAPI.setController('someController', {});

            assert.property(hermione, 'someController');
        });

        it('should remove controller on AFTER_FILE_READ', () => {
            const hermione = {};
            const testParser = mkTestParser_();
            const parserAPI = TestParserAPI.create(testParser, hermione);

            parserAPI.setController('someController', {});

            testParser.emit(RunnerEvents.AFTER_FILE_READ);

            assert.notProperty(hermione, 'someController');
        });

        it('should set controller methods', () => {
            const hermione = {};
            const parserAPI = TestParserAPI.create(mkTestParser_(), hermione);

            parserAPI.setController('someController', {
                doStuff: () => {},
                doOtherStuff: () => {}
            });

            assert.property(hermione.someController, 'doStuff');
            assert.property(hermione.someController, 'doOtherStuff');
        });

        it('controller methods should be chainable', () => {
            const hermione = {};
            const parserAPI = TestParserAPI.create(mkTestParser_(), hermione);

            parserAPI.setController('someController', {doStuff: sinon.spy()});

            const res = hermione.someController.doStuff();

            assert.equal(res, hermione.someController);
        });

        it('should not call controller methods if nothing parsed', () => {
            const hermione = {};
            const parserAPI = TestParserAPI.create(mkTestParser_(), hermione);

            const doStuff = sinon.spy();
            parserAPI.setController('someController', {doStuff});

            hermione.someController.doStuff();

            assert.notCalled(doStuff);
        });

        it('should call controller method on parsed suite', () => {
            const hermione = {};
            const testParser = mkTestParser_();
            const parserAPI = TestParserAPI.create(testParser, hermione);

            const doStuff = sinon.spy();
            parserAPI.setController('someController', {doStuff});

            hermione.someController.doStuff('foo', {bar: 'baz'});

            const suite = makeSuite();
            testParser.emit(ParserEvents.SUITE, suite);

            assert.calledOn(doStuff, suite);
            assert.calledWith(doStuff, 'foo', {bar: 'baz'});
        });

        it('should call controller method only once for parsed suite', () => {
            const hermione = {};
            const testParser = mkTestParser_();
            const parserAPI = TestParserAPI.create(testParser, hermione);

            const doStuff = sinon.spy();
            parserAPI.setController('someController', {doStuff});

            hermione.someController.doStuff();

            const suite = makeSuite();
            testParser.emit(ParserEvents.SUITE, suite);
            testParser.emit(ParserEvents.SUITE, makeSuite());

            assert.calledOnce(doStuff);
            assert.calledOn(doStuff, suite);
        });

        it('should call controller method on parsed test', () => {
            const hermione = {};
            const testParser = mkTestParser_();
            const parserAPI = TestParserAPI.create(testParser, hermione);

            const doStuff = sinon.spy();
            parserAPI.setController('someController', {doStuff});

            hermione.someController.doStuff('foo', {bar: 'baz'});

            const test = makeTest();
            testParser.emit(ParserEvents.TEST, test);

            assert.calledOn(doStuff, test);
            assert.calledWith(doStuff, 'foo', {bar: 'baz'});
        });

        it('should call controller method only once for parsed test', () => {
            const hermione = {};
            const testParser = mkTestParser_();
            const parserAPI = TestParserAPI.create(testParser, hermione);

            const doStuff = sinon.spy();
            parserAPI.setController('someController', {doStuff});

            hermione.someController.doStuff();

            const test = makeTest();
            testParser.emit(ParserEvents.TEST, test);
            testParser.emit(ParserEvents.TEST, makeTest());

            assert.calledOnce(doStuff);
            assert.calledOn(doStuff, test);
        });
    });
});
