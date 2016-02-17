'use strict';

var proxyquire = require('proxyquire').noCallThru();

describe('plugins', function() {
    var hermione,
        nodeModules;

    beforeEach(function() {
        hermione = sinon.spy();
        nodeModules = {};
    });

    function load_(pluginOpts) {
        hermione.config = {
            plugins: pluginOpts
        };

        proxyquire('../../lib/plugins', nodeModules).load(hermione);
    }

    describe('load', function() {
        it('should load plugin specified in config without prefix', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should load plugin with prefix', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({'hermione-foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should load plugin without prefix', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'foobar': foobarPlugin
            };

            load_({'foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should prefer plugin with prefix', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin'),
                someOtherModule = sinon.spy().named('someOtherModule');

            nodeModules = {
                'hermione-foobar': foobarPlugin,
                'foobar': someOtherModule
            };

            load_({'foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
            assert.notCalled(someOtherModule);
        });

        it('should throw error if plugin not found', function() {
            assert.throws(function() {
                load_({'hermione-foo': true});
            });
        });

        it('should not load disabled plugins', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: false});

            assert.notCalled(foobarPlugin);
        });

        it('should load plugin with empty configuration', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: {}});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should handle empty plugins', function() {
            assert.doesNotThrow(function() {
                load_();
            });
        });

        it('should handle no plugins', function() {
            assert.doesNotThrow(function() {
                load_({});
            });
        });

        it('should pass plugin its configuration', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: {foo: 'bar'}});

            assert.calledWith(foobarPlugin, hermione, {foo: 'bar'});
        });
    });
});
