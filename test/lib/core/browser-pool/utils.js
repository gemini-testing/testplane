'use strict';

const utils = require('build/core/browser-pool/utils');

describe('browser-pool/utils', () => {
    describe('buildCompositeBrowserId', () => {
        it('shold build id based on browser id only', () => {
            assert.equal(utils.buildCompositeBrowserId('bro'), 'bro');
        });

        it('shold build id based on both browser id and version', () => {
            assert.equal(utils.buildCompositeBrowserId('bro', '32.1'), 'bro.32.1');
        });
    });
});
