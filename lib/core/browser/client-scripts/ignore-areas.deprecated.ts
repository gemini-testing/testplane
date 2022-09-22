import type * as libTypings from './lib.native';

const lib: typeof libTypings = require('./lib');

export default function queryIgnoreAreas(selector: string | { every: string }): Array<Node> | NodeListOf<Node> {
    if (typeof selector === 'string') {
        const node = lib.queryFirst(selector);

        return node ? [node] : [];
    }

    return lib.queryAll(selector.every);
}
