'use strict';

var proxyquire = require('proxyquire').noCallThru();

describe('plugins', function() {
    var e2eRunner,
        nodeModules;

    beforeEach(function() {
        e2eRunner = sinon.spy();
        nodeModules = {};
    });

    function load_(pluginOpts) {
        e2eRunner.config = {
            plugins: pluginOpts
        };

        proxyquire('../../lib/plugins', nodeModules).load(e2eRunner);
    }

    describe('load', function() {
        it('should load plugin specified in config without prefix', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'e2e-runner-foobar': foobarPlugin
            };

            load_({foobar: true});

            assert.calledWith(foobarPlugin, e2eRunner, {});
        });

        it('should load plugin with prefix', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'e2e-runner-foobar': foobarPlugin
            };

            load_({'e2e-runner-foobar': true});

            assert.calledWith(foobarPlugin, e2eRunner, {});
        });

        it('should load plugin without prefix', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'foobar': foobarPlugin
            };

            load_({'foobar': true});

            assert.calledWith(foobarPlugin, e2eRunner, {});
        });

        it('should prefer plugin with prefix', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin'),
                someOtherModule = sinon.spy().named('someOtherModule');

            nodeModules = {
                'e2e-runner-foobar': foobarPlugin,
                'foobar': someOtherModule
            };

            load_({'foobar': true});

            assert.calledWith(foobarPlugin, e2eRunner, {});
            assert.notCalled(someOtherModule);
        });

        it('should throw error if plugin not found', function() {
            assert.throws(function() {
                load_({'e2e-runner-foo': true});
            });
        });

        it('should not load disabled plugins', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'e2e-runner-foobar': foobarPlugin
            };

            load_({foobar: false});

            assert.notCalled(foobarPlugin);
        });

        it('should load plugin with empty configuration', function() {
            var foobarPlugin = sinon.spy().named('foobarPlugin');
            nodeModules = {
                'e2e-runner-foobar': foobarPlugin
            };

            load_({foobar: {}});

            assert.calledWith(foobarPlugin, e2eRunner, {});
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
                'e2e-runner-foobar': foobarPlugin
            };

            load_({foobar: {foo: 'bar'}});

            assert.calledWith(foobarPlugin, e2eRunner, {foo: 'bar'});
        });
    });
});
