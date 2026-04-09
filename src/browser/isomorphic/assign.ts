/** ES5-safe Object.assign polyfill for use in browser bundles targeting old browsers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assign<T>(target: T, ...sources: any[]): T {
    for (let i = 0; i < sources.length; i++) {
        const source = sources[i];

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                (target as Record<string, unknown>)[key] = (source as Record<string, unknown>)[key];
            }
        }
    }

    return target;
}
