export type StorageData = {
    localStorage?: Record<string, unknown>;
    sessionStorage?: Record<string, unknown>;
};

export const dumpStorage = (): StorageData => {
    const getData = (storage: Storage): Record<string, unknown> | undefined => {
        const data: Record<string, string> = {};

        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);

            if (key) {
                data[key] = storage.getItem(key) as string;
            }
        }

        return Object.keys(data).length === 0 ? undefined : data;
    };

    try {
        return {
            localStorage: getData(window?.localStorage),
            sessionStorage: getData(window?.sessionStorage),
        };
    } catch (error) {
        return {
            localStorage: undefined,
            sessionStorage: undefined,
        };
    }
};
