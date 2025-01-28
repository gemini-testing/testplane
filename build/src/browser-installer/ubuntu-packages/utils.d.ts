/** @link https://manpages.org/which */
export declare const ensureUnixBinaryExists: (binaryName: string) => Promise<void>;
export declare const isUbuntu: () => Promise<boolean>;
export declare const getUbuntuMilestone: () => Promise<string>;
