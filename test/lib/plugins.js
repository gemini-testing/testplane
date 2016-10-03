'use strict';

const proxyquire = require('proxyquire').noCallThru();

const utils = require('../../lib/utils');

describe('plugins', () => {
    let hermione;
    let nodeModules;
    let foobarPlugin;

    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
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

    describe('load', () => {
        it('should load plugin specified in config without prefix', () => {
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should load plugin with prefix', () => {
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({'hermione-foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should load plugin without prefix', () => {
            nodeModules = {
                'foobar': foobarPlugin
            };

            load_({'foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should prefer plugin with prefix', () => {
            const someOtherModule = sinon.spy().named('someOtherModule');

            utils.require.returns(foobarPlugin);

            nodeModules = {
                'hermione-foobar': foobarPlugin,
                'foobar': someOtherModule
            };

            load_({'foobar': true});

            assert.calledWith(foobarPlugin, hermione, {});
            assert.notCalled(someOtherModule);
        });

        it('should throw error if plugin was not found', () => {
            utils.require.restore();

            assert.throws(() => load_({'hermione-foo': true}));
        });

        it('should throw an error if plugin has internal error', () => {
            utils.require.withArgs('hermione-foobar').throws(new Error('some plugin error'));

            assert.throws(() => load_({'hermione-foobar': true}), /some plugin error/);
        });

        it('should not load disabled plugins', () => {
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: false});

            assert.notCalled(foobarPlugin);
        });

        it('should load plugin with empty configuration', () => {
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: {}});

            assert.calledWith(foobarPlugin, hermione, {});
        });

        it('should handle empty plugins', () => {
            assert.doesNotThrow(() => load_());
        });

        it('should handle no plugins', () => {
            assert.doesNotThrow(() => load_({}));
        });

        it('should pass plugin its configuration', () => {
            nodeModules = {
                'hermione-foobar': foobarPlugin
            };

            load_({foobar: {foo: 'bar'}});

            assert.calledWith(foobarPlugin, hermione, {foo: 'bar'});
        });
    });
});
