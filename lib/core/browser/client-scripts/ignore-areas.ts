import type * as libTypings from './lib.native';

const lib: typeof libTypings = require('./lib');

export function queryIgnoreAreas(selector: string): Array<Node> | NodeListOf<Node> {
    return lib.queryAll(selector);
}
