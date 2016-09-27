'use strict';

var proxyquire = require('proxyquire').noCallThru();

const fs = require('fs');
const utils = require('../../lib/utils');

describe('plugins', function() {
    var hermione,
        nodeModules;

    let foobarPlugin;

    const sandbox = sinon.sandbox.create();

    beforeEach(function() {
        foobarPlugin = sandbox.spy().named('foobarPlugin');
        sandbox.stub(utils, 'require').returns(foobarPlugin);

        hermione = sinon.spy();
        nodeModules = {};
    });

    afterEach(() => sandbox.restore());

    function load_(pluginOpts) {
        hermione.config = {
            plugins: pluginOpts
        };

        proxyquire('../../lib/plugins', nodeModules).load(hermione);
    }

    describe('load', function() {
        it('should load plugin specified in config without prefix', function() {
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should load plugin with prefix', function() {
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({'hermione-foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should load plugin without prefix', function() {
            nodeModules = {
                'foobar': foobarPlugin
            };

            load_({'foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should prefer plugin with prefix', function() {
            var someOtherModule = sinon.spy().named('someOtherModule');
            utils.require.returns(foobarPlugin);

            nodeModules = {
                'hermione-foobar': foobarPlugin,
                'foobar': someOtherModule
            };

            load_({'foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
            assert.notCalled(someOtherModule);
        });

        it('should throw error if plugin not found', function() {
            utils.require.restore();

            assert.throws(function() {
                load_({'hermione-foo': true});
            });
        });

        it('should throw an error if plugin has internal error', () => {
            utils.require.withArgs('hermione-foobar').throws(new Error('some plugin error'));

            assert.throws(() => load_({'hermione-foobar': true}), /some plugin error/);
        });

        it('should not load disabled plugins', function() {
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: false});

            assert.notCalled(foobarPlugin);
        });

        it('should load plugin with empty configuration', function() {
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
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: {foo: 'bar'}});

            assert.calledWith(foobarPlugin, hermione, {foo: 'bar'});
        });
    });
});
