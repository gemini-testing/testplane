export interface NormalizedDependencies {
    /** Project-wide styles */
    css: string[];
    /** Project-wide scripts */
    js: string[];
    /** Module names from node_modules (e.g. "react", "@remix-run/router") */
    modules: string[];
}
