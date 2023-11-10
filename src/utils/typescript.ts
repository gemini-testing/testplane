import _ from "lodash";

export const tryToRegisterTsNode = (): void => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { REGISTER_INSTANCE } = require("ts-node");

        if (_.get(process, REGISTER_INSTANCE)) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { register }: typeof import("ts-node") = require("ts-node");
        let swc = false;

        try {
            require("@swc/core");
            swc = true;
        } catch {} // eslint-disable-line no-empty

        const skipProjectRaw = process.env.TS_NODE_SKIP_PROJECT ?? "true";
        const transpileOnlyRaw = process.env.TS_NODE_TRANSPILE_ONLY ?? "true";
        const swcRaw = process.env.TS_NODE_SWC ?? swc.toString();

        try {
            register({
                skipProject: JSON.parse(skipProjectRaw),
                transpileOnly: JSON.parse(transpileOnlyRaw),
                swc: JSON.parse(swcRaw),
            });
        } catch (err) {
            const params = `swc: "${swcRaw}", transpileOnly: "${transpileOnlyRaw}", skipProject: "${skipProjectRaw}"`;
            console.error(`hermione: an error occured while trying to register ts-node (${params}):`, err);
        }
    } catch {} // eslint-disable-line no-empty
};
