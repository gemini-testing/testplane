import { inspect } from "util";
import { isPromise } from "util/types";
import _ from "lodash";
import { TestStep, TestStepKey } from "../../types";
import { TimeTravelMode } from "../../config";

const MAX_STRING_LENGTH = 50;

type HookFunctions<T> = {
    fn: () => T;
    before: () => void;
    after: () => void;
    error: (err: unknown) => unknown;
};

export const normalizeCommandArgs = (commandName: string, args: unknown[] = []): string[] => {
    if (commandName === "execute") {
        return ["code"];
    }

    return args.map(arg => {
        try {
            if (typeof arg === "string") {
                return _.truncate(arg, { length: MAX_STRING_LENGTH });
            }

            if (isPromise(arg)) {
                return "promise";
            }

            if (_.isPlainObject(arg)) {
                return _.truncate(
                    inspect(arg, { depth: 0, compact: true, breakLength: Infinity, maxArrayLength: 10 }),
                    { length: MAX_STRING_LENGTH },
                );
            }

            return _.truncate(String(arg), { length: MAX_STRING_LENGTH });
        } catch (err) {
            return "unknown";
        }
    });
};

export const isGroup = (node: TestStep): boolean => Boolean(node && node[TestStepKey.IsGroup]);

export const runWithHooks = <T>({ fn, before, after, error }: HookFunctions<T>): T => {
    let isReturnedValuePromise = false;

    before();

    try {
        const value = fn();

        if (isPromise(value)) {
            isReturnedValuePromise = true;

            return value
                .catch((err: unknown) => {
                    error(err);

                    throw err;
                })
                .finally(after)
                .then(() => value) as T; // It's valid to convert Promise to T since value is already Promise here
        }

        return value;
    } catch (err) {
        if (!isReturnedValuePromise) {
            error(err);
        }

        throw err;
    } finally {
        if (!isReturnedValuePromise) {
            after();
        }
    }
};

export const shouldRecordSnapshots = (timeTravelMode: TimeTravelMode, isRetry: boolean): boolean => {
    return (
        timeTravelMode === TimeTravelMode.On ||
        timeTravelMode === TimeTravelMode.LastFailedRun ||
        (timeTravelMode === TimeTravelMode.RetriesOnly && isRetry)
    );
};
