'use strict';

const path = require('path');
const Promise = require('bluebird');
const browserify = require('browserify');
const ClientBridge = require('./client-bridge');

exports.ClientBridge = ClientBridge;

exports.build = (browser, opts = {}) => {
    const script = browserify({
        entries: './index',
        basedir: path.join(__dirname, '..', 'client-scripts')
    });

    script.transform({
        sourcemap: false,
        global: true,
        compress: {screw_ie8: false}, // eslint-disable-line camelcase
        mangle: {screw_ie8: false}, // eslint-disable-line camelcase
        output: {screw_ie8: false} // eslint-disable-line camelcase
    }, 'uglifyify');

    const lib = opts.calibration && opts.calibration.needsCompatLib ? './src.compat.js' : './src.native.js';
    const ignoreAreas = opts.supportDeprecated ? './ignore-areas.deprecated.js' : './ignore-areas.js';

    script.transform({
        aliases: {
            './lib': {relative: lib},
            './ignore-areas': {relative: ignoreAreas}
        },
        verbose: false
    }, 'aliasify');

    return Promise.fromCallback((cb) => script.bundle(cb))
        .then((buf) => {
            const scripts = buf.toString();

            return ClientBridge.create(browser, scripts);
        });
};
