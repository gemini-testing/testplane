export function formatTestInfo(test: any): string;
export function getTestInfo(test: any): {
    fullTitle: any;
    browserId: any;
    file: string | undefined;
    sessionId: any;
    duration: any;
    startTime: any;
    meta: any;
};
export function extendTestInfo(test: any, opts: any): any;
export function formatFailedTests(tests: any): any[];
