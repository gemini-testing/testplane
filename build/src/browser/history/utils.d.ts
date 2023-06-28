export function normalizeCommandArgs(name: any, args?: any[]): any[];
export namespace historyDataMap {
    const NAME: string;
    const ARGS: string;
    const SCOPE: string;
    const DURATION: string;
    const TIME_START: string;
    const TIME_END: string;
    const IS_OVERWRITTEN: string;
    const IS_GROUP: string;
    const IS_FAILED: string;
    const CHILDREN: string;
    const KEY: string;
}
export function isGroup(node: any): boolean;
export function runWithHooks({ fn, before, after, error }: {
    fn: any;
    before: any;
    after: any;
    error: any;
}): any;
