import _ from "lodash";
import logger from "./logger";

export const tryToRegisterTsNode = (): void => {
    if (process.env.TS_ENABLE === "false") {
        return;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { REGISTER_INSTANCE } = require("ts-node");

        if (_.get(process, REGISTER_INSTANCE)) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { register }: typeof import("ts-node") = require("ts-node");

        const skipProjectRaw = process.env.TS_NODE_SKIP_PROJECT ?? "true";
        const transpileOnlyRaw = process.env.TS_NODE_TRANSPILE_ONLY ?? "true";
        const swcRaw = process.env.TS_NODE_SWC ?? "true";

        if (JSON.parse(swcRaw)) {
            try {
                register({
                    skipProject: JSON.parse(skipProjectRaw),
                    transpileOnly: JSON.parse(transpileOnlyRaw),
                    swc: true,
                    compilerOptions: {
                        allowJs: true,
                    },
                });
                return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                if (err.code === "MODULE_NOT_FOUND") {
                    logger.warn(
                        `testplane: you may install @swc/core for significantly faster reading of typescript tests.`,
                    );
                } else {
                    logger.warn(`testplane: could not load @swc/core:`, err);
                }
            }
        }

        try {
            register({
                skipProject: JSON.parse(skipProjectRaw),
                transpileOnly: JSON.parse(transpileOnlyRaw),
                swc: false,
                compilerOptions: {
                    allowJs: true,
                    module: "nodenext",
                    moduleResolution: "nodenext",
                },
            });
            return;
            // eslint-disable-next-line no-empty
        } catch (err) {}

        try {
            register({
                skipProject: JSON.parse(skipProjectRaw),
                transpileOnly: JSON.parse(transpileOnlyRaw),
                swc: false,
                compilerOptions: {
                    allowJs: true,
                },
            });
            return;
            // eslint-disable-next-line no-empty
        } catch (err) {
            const params = `swc: "false", transpileOnly: "${transpileOnlyRaw}", skipProject: "${skipProjectRaw}"`;
            logger.warn(
                `testplane: an error occured while trying to register ts-node (${params}). TypeScript tests won't be read:`,
                err,
            );
        }
    } catch {} // eslint-disable-line no-empty
};
