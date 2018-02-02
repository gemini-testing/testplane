'use strict';

const webdriverio = require('webdriverio');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('./utils');

describe('NewBrowser', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_(sandbox);
        sandbox.stub(webdriverio, 'remote');
        webdriverio.remote.returns(session);
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        describe('meta-info access commands', () => {
            it('should add meta-info access commands', () => {
                const browser = mkBrowser_();

                assert.calledWith(session.addCommand, 'setMeta');
                assert.calledWith(session.addCommand, 'getMeta');

                session.setMeta('foo', 'bar');

                assert.equal(session.getMeta('foo'), 'bar');
                assert.deepEqual(browser.meta, {foo: 'bar'});
            });

            it('should set empty meta-info by default', () => {
                const browser = mkBrowser_();

                assert.deepEqual(browser.meta, {});
            });

            it('should set meta-info with provided meta option', () => {
                const browser = mkBrowser_({meta: {k1: 'v1'}});

                assert.deepEqual(browser.meta, {k1: 'v1'});
            });
        });

        describe('url decorator', () => {
            it('should force rewrite base `url` method', () => {
                mkBrowser_();

                assert.calledWith(session.addCommand, 'url', sinon.match.func, true);
            });

            it('should call base `url` method', () => {
                const baseUrlFn = session.url;

                mkBrowser_();

                session.url('/foo/bar?baz=qux');

                assert.calledWith(baseUrlFn, 'http://base_url/foo/bar?baz=qux');
                assert.calledOn(baseUrlFn, session);
            });

            it('should add last url to meta-info and replace path if it starts from /', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/root'});

                session
                    .url('/some/url')
                    .url('/foo/bar?baz=qux');

                assert.equal(browser.meta.url, 'http://some.domain.org/foo/bar?baz=qux');
            });

            it('should add last url to meta-info if it contains only query part', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/root'});

                session.url('?baz=qux');

                assert.equal(browser.meta.url, 'http://some.domain.org/root?baz=qux');
            });

            it('should concat url without slash at the beginning to the base url', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org'});

                session.url('some/url');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
            });

            it('should not remove the last slash from meta url', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org'});

                session.url('/some/url/');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url/');
            });

            it('should remove consecutive slashes in meta url', () => {
                const browser = mkBrowser_({baseUrl: 'http://some.domain.org/'});

                session.url('/some/url');

                assert.equal(browser.meta.url, 'http://some.domain.org/some/url');
            });

            it('should not save any url if `url` called as getter', () => {
                const browser = mkBrowser_();

                session.url();

                assert.notProperty(browser.meta, 'url');
            });
        });

        it('should add "assertView" command', () => {
            mkBrowser_();

            assert.calledWith(session.addCommand, 'assertView');
        });
    });
});
