import url from "node:url";
import path from "node:path";
import { HERMIONE_BROWSER_EVENT_SUFFIX } from "./constants";
import { HERMIONE_WORKER_EVENT_SUFFIX } from "../../../worker/browser-env/constants";
import type { BrowserPayload } from "./types";
import type { WorkerPayload } from "../../../worker/browser-env/types";

// TODO: use import.meta.url after move to esm
export const getImportMetaUrl = (path: string): string => {
    return url.pathToFileURL(path).toString();

    // return url.pathToFileURL(path).toString().replace('file:///Users/dudkevich/job/projects/gemini-testing/hermione', 'file:///Users/dudkevich/job/hermione-test-project-2/node_modules/hermione');
};

export const getNodeModulePath = async ({
    moduleName,
    rootDir = process.cwd(),
    parent = "node_modules",
}: {
    moduleName: string;
    rootDir?: string;
    parent?: string;
}): Promise<string> => {
    const rootFileUrl = url.pathToFileURL(rootDir).href;

    // TODO: use import at the beginning of the file after migrate to esm
    const { resolve } = await eval(`import("import-meta-resolve")`);

    return resolve(moduleName, path.join(rootFileUrl, parent));
    // return resolve(moduleName, path.join(rootFileUrl, parent)).replace('file:///Users/dudkevich/job/projects/gemini-testing/hermione', 'file:///Users/dudkevich/job/hermione-test-project-2/node_modules/hermione');
};

export const isBrowserMessage = (msg: BrowserPayload | WorkerPayload): msg is BrowserPayload => {
    return msg.event?.startsWith(HERMIONE_BROWSER_EVENT_SUFFIX);
};

export const isWorkerMessage = (msg: BrowserPayload | WorkerPayload): msg is WorkerPayload => {
    return msg.event?.startsWith(HERMIONE_WORKER_EVENT_SUFFIX);
};

export function normalizeId(id: string, base?: string): string {
    if (base && id.startsWith(base)) {
        id = `/${id.slice(base.length)}`
    }

    return id
        .replace(/^\/@id\/__x00__/, '\0') // virtual modules start with `\0`
        .replace(/^\/@id\//, '')
        .replace(/^__vite-browser-external:/, '')
        .replace(/^node:/, '')
        .replace(/[?&]v=\w+/, '?') // remove ?v= query
        .replace(/\?$/, '') // remove end query mark
}
