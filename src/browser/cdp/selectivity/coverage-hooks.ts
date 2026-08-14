const PAGE_START_FUNCTION = "__testplane_cdp_coverage_page_start";
const BFCACHE_RESTORE_FUNCTION = "__testplane_cdp_coverage_bfcache_restore";
const BEFORE_UNLOAD_FUNCTION = "__testplane_cdp_coverage_snapshot_pause";
const HOOKS_MARKER = "__testplane_cdp_coverage_hooks_installed";

export const CoveragePause = {
    PageStart: "pageStart",
    BfcacheRestore: "bfcacheRestore",
    BeforeUnload: "beforeUnload",
} as const;

type CoveragePause = (typeof CoveragePause)[keyof typeof CoveragePause];

const createCoverageHooksScript = (pauseAtPageStart: boolean): string =>
    [
        `if (window.top === window && !window.${HOOKS_MARKER}) {`,
        `    Object.defineProperty(window, "${HOOKS_MARKER}", { value: true });`,
        `    function ${PAGE_START_FUNCTION}() { debugger; }`,
        `    function ${BFCACHE_RESTORE_FUNCTION}() { debugger; }`,
        pauseAtPageStart ? `    ${PAGE_START_FUNCTION}();` : null,
        `    window.addEventListener("pageshow", function (e) { if (e.persisted) { ${BFCACHE_RESTORE_FUNCTION}(); } });`,
        `    window.addEventListener("beforeunload", function ${BEFORE_UNLOAD_FUNCTION}() { debugger; });`,
        "}",
    ]
        .filter(Boolean)
        .join("\n");

/** Hooks injected into every document and, once, into the already open document. */
export const coverageHooksScripts = {
    newDocument: createCoverageHooksScript(true),
    currentDocument: createCoverageHooksScript(false),
};

export const getCoveragePause = (functionName?: string): CoveragePause | null => {
    switch (functionName) {
        case PAGE_START_FUNCTION:
            return CoveragePause.PageStart;
        case BFCACHE_RESTORE_FUNCTION:
            return CoveragePause.BfcacheRestore;
        case BEFORE_UNLOAD_FUNCTION:
            return CoveragePause.BeforeUnload;
        default:
            return null;
    }
};
