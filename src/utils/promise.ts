export function promiseMethod<T, ThisArg = unknown, Args extends unknown[] = unknown[]>(
    fn: (this: ThisArg, ...args: Args) => T,
): (this: ThisArg, ...args: Args) => Promise<T> {
    return function (this: ThisArg, ...args: Args): Promise<T> {
        try {
            const result = fn.apply(this, args);
            return Promise.resolve(result);
        } catch (err) {
            return Promise.reject(err);
        }
    };
}

export function promiseTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            if (!isCancelled) {
                reject(new Error(message));
            }
        }, ms);

        if (timeoutId.unref) {
            timeoutId.unref();
        }
    });

    const wrappedPromise = new Promise<T>((resolve, reject) => {
        promise.then(
            value => {
                if (!isCancelled) {
                    resolve(value);
                }
            },
            error => {
                if (!isCancelled) {
                    reject(error);
                }
            },
        );
    });

    return Promise.race([wrappedPromise, timeoutPromise]).finally(() => {
        isCancelled = true;
        clearTimeout(timeoutId);
    });
}

export function promiseDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function promiseMapSeries<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R> | R,
): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i++) {
        results.push(await Promise.resolve(mapper(items[i], i)));
    }

    return results;
}
