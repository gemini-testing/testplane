import _ from 'lodash';

export const tryToRegisterTsNode = (): void => {
    try {
        const {REGISTER_INSTANCE} = require('ts-node');

        if (Boolean(_.get(process, REGISTER_INSTANCE))) {
            return;
        }

        const {register}: typeof import('ts-node') = require('ts-node');
        let swc = false;

        try {
            require('@swc/core');
            swc = true;
        } catch {}

        register({
            skipProject: JSON.parse(process.env.TS_NODE_SKIP_PROJECT ?? 'true'),
            transpileOnly: JSON.parse(process.env.TS_NODE_TRANSPILE_ONLY ?? 'true'),
            swc: JSON.parse(process.env.TS_NODE_SWC ?? swc.toString())
        });

    } catch {}
}
