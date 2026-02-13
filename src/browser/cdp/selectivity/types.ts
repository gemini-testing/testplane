export interface NormalizedDependencies {
    /** Project-wide styles */
    css: string[];
    /** Project-wide scripts */
    js: string[];
    /** Module names from node_modules (e.g. "react", "@remix-run/router") */
    modules: string[];
}

export const Compression = {
    NONE: "none",
    GZIP: "gz",
    BROTLI: "br",
    ZSTD: "zstd",
} as const;

export type SelectivityCompressionType = (typeof Compression)[keyof typeof Compression];

export type HashFileContents = {
    files: Record<string, string>;
    modules: Record<string, string>;
    patterns: Record<string, string>;
};

export type CachedOnFs = true;
export type ActualValue = string;
export type SelectivityAssetState = Promise<
    | CachedOnFs // Acknowledged asset presence in fs cache
    | ActualValue // Actual asset value
    | Error // An error, occured while trying to aquire asset
    | null // No source maps are present
>;
