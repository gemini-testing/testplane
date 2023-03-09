import _ from 'lodash';

export const tryToRegisterTsNode = (): void => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const {REGISTER_INSTANCE} = require('ts-node');

        if (_.get(process, REGISTER_INSTANCE)) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const {register}: typeof import('ts-node') = require('ts-node');
        let swc = false;

        try {
            require('@swc/core');
            swc = true;
        } catch {} // eslint-disable-line no-empty

        register({
            skipProject: JSON.parse(process.env.TS_NODE_SKIP_PROJECT ?? 'true'),
            transpileOnly: JSON.parse(process.env.TS_NODE_TRANSPILE_ONLY ?? 'true'),
            swc: JSON.parse(process.env.TS_NODE_SWC ?? swc.toString())
        });

    } catch {} // eslint-disable-line no-empty
}
