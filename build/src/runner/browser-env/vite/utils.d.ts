import type { Connect } from "vite";
import type { WorkerInitializePayload } from "./browser-modules/types";
type TestInfoFromViteRequest = {
    routeName: string;
    runUuid: string;
    env: WorkerInitializePayload;
};
export declare const getImportMetaUrl: (path: string) => string;
export declare const getNodeModulePath: ({ moduleName, rootDir, parent, }: {
    moduleName: string;
    rootDir?: string | undefined;
    parent?: string | undefined;
}) => Promise<string>;
export declare const prepareError: (error: Error) => Error;
export declare const getTestInfoFromViteRequest: (req: Connect.IncomingMessage) => TestInfoFromViteRequest | null;
export declare const getPathWithoutExtName: (fsPath: string) => string;
export {};
