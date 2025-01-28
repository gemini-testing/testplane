export { isUbuntu, getUbuntuMilestone, ensureUnixBinaryExists } from "./utils";
export declare const writeUbuntuPackageDependencies: (ubuntuMilestone: string, deps: string[]) => Promise<void>;
export declare const installUbuntuPackageDependencies: () => Promise<string>;
export declare const getUbuntuLinkerEnv: () => Promise<Record<string, string>>;
