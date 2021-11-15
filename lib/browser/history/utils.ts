import _ from 'lodash';

const MAX_STRING_LENGTH = 50;

export const normalizeCommandArgs = (name: string, args: Array<any>): Array<any> => {
    if (name === 'execute') {
        return ['code'];
    }

    return args.map((arg) => {
        if (_.isString(arg)) {
            return _.truncate(arg, {length: MAX_STRING_LENGTH});
        }

        if (_.isPlainObject(arg)) {
            return 'obj';
        }

        return arg;
    });
};

export enum historyDataMap {
    NAME = 'n',
    ARGS = 'a',
    SCOPE = 's',
    DURATION = 'd',
    TIME_START = 'ts',
    TIME_END = 'te',
    IS_OVERWRITTEN = 'o',
    CHILDREN = 'c'
}

const isPromise = (val: any): boolean => typeof _.get(val, 'then') === 'function';

export const runWithHooks = <T extends (...args: Array<any>) => any>({fn, before, after}: {
    fn: T;
    before: Function;
    after: Function;
}): ReturnType<T> => {
    let isReturnedValuePromise = false;

    before();

    try {
        const value = fn();

        if (isPromise(value)) {
            isReturnedValuePromise = true;

            return value.finally(after);
        }

        return value;
    } finally {
        if (!isReturnedValuePromise) {
            after();
        }
    }
};
