export function normalizeCommandArgs(name: any, args?: any[]): any[];
export namespace historyDataMap {
    let NAME: string;
    let ARGS: string;
    let SCOPE: string;
    let DURATION: string;
    let TIME_START: string;
    let TIME_END: string;
    let IS_OVERWRITTEN: string;
    let IS_GROUP: string;
    let IS_FAILED: string;
    let CHILDREN: string;
    let KEY: string;
}
export function isGroup(node: any): boolean;
export function runWithHooks({ fn, before, after, error }: {
    fn: any;
    before: any;
    after: any;
    error: any;
}): any;
