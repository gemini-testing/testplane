import path from 'path';
import Bluebird from 'bluebird';
import browserify from 'browserify';

import ClientBridge from './client-bridge';

import type {CalibrationResult} from '../types/calibrator';
import type ExistingBrowser from '../../browser/existing-browser';

export {default as ClientBridge} from './client-bridge';

type BuildClientBridgeOpts = {
    coverage?: boolean;
    calibration?: CalibrationResult;
    supportDeprecated?: boolean;
};

export const build = async (browser: ExistingBrowser, opts: BuildClientBridgeOpts = {}): Promise<ClientBridge> => {
    const script = browserify({
        entries: './index',
        basedir: path.join(__dirname, '..', 'browser', 'client-scripts')
    });

    if (!opts.coverage) {
        script.exclude('./index.coverage');
    }

    script.transform('uglifyify', {
        sourceMap: false,
        global: true,
        ie8: true
    });

    const lib = opts.calibration && opts.calibration.needsCompatLib ? './lib.compat.js' : './lib.native.js';
    const ignoreAreas = opts.supportDeprecated ? './ignore-areas.deprecated.js' : './ignore-areas.js';

    script.transform('aliasify', {
        aliases: {
            './lib': {relative: lib},
            './ignore-areas': {relative: ignoreAreas}
        },
        verbose: false
    });

    const buf = await Bluebird.fromCallback((cb: (err: Error, src: Buffer) => void) => script.bundle(cb));
    const scripts = buf.toString();

    return ClientBridge.create(browser, scripts);
};
