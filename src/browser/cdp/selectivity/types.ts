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
