import url from "node:url";
import createDebug from "debug";
import { MODULE_NAMES, WORKER_ENV_BY_RUN_UUID } from "../constants";
import logger from "../../../../utils/logger";
import type { WorkerInitMessage } from "../browser-modules/types"

import type { Plugin } from "vite";

const debug = createDebug("vite:plugin:generateIndexHtml");

export const plugin = (): Plugin[] => {
    return [
        {
            name: "hermione:generateIndexHtml",
            enforce: "pre",
            configureServer(server) {
                return () => {
                    server.middlewares.use(async (req, res, next) => {
                        debug(`Received request for: ${req.originalUrl}`);

                        if (!req.url?.endsWith("index.html") || !req.originalUrl) {
                            return next();
                        }

                        const urlParsed = url.parse(req.originalUrl);
                        const urlParamString = new URLSearchParams(urlParsed.query || "");

                        try {
                            const runUuid = urlParamString.get("runUuid");
                            if (!runUuid) {
                                throw new Error(`query parameter "runUuid" is not specified in url: ${req.originalUrl}`);
                            }

                            const env = WORKER_ENV_BY_RUN_UUID.get(runUuid);
                            if (!env) {
                                throw new Error(`worker environment is not found by runUuid=${runUuid}`)
                            }

                            const template = generateTemplate(env);
                            res.end(await server.transformIndexHtml(`${req.originalUrl}`, template));
                        } catch (err) {
                            const template = generateErrorTemplate(err as Error);
                            logger.error(`Failed to render template: ${err}`);
                            res.end(await server.transformIndexHtml(`${req.originalUrl}`, template));
                        }

                        return next();
                    });
                };
            },
        },
    ];
};

function generateTemplate(env: WorkerInitMessage): string {
    return `
<!DOCTYPE html>
<html>
    <head>
        <title>Hermione Browser Test</title>
        <script>var exports = {};</script>
        <script type="module">
            window.__hermione__ = ${JSON.stringify(env)};
        </script>
        <script type="module" src="${MODULE_NAMES.globals}"></script>
        <script type="module" src="${MODULE_NAMES.mocha}"></script>
        <script type="module" src="${MODULE_NAMES.browserRunner}"></script>
    </head>
    <body></body>
</html>
`;
}

function generateErrorTemplate(error: Error): string {
    return `
<!DOCTYPE html>
<html>
    <body>
        <pre>${error.stack}</pre>
    </body>
</html>
`;
}
