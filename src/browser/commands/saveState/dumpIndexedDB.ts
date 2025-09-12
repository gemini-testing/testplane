export interface DumpIndexDB {
    version?: number;
    stores: Record<string, unknown>;
}

export interface DumpStoreIndexDB {
    keyPath: string | string[];
    autoIncrement: boolean;
    indexes: {
        name: string,
        keyPath: string | string[];
        unique: boolean,
        multiEntry: boolean,
    }[]
    records: {
        key: unknown;
        value: unknown;
    }[]
}

export async function dumpIndexedDB(): Promise<Record<string, unknown>> {
    if (!("databases" in indexedDB)) {
        throw new Error("Your browser don't indexedDB.databases()");
    }

    const dbList = await indexedDB.databases(); // список баз
    const result: Record<string, unknown> = {};

    for (const dbInfo of dbList) {
        const name = dbInfo.name;
        const version = dbInfo.version;
        if (!name) continue;

        const dbDump: DumpIndexDB = { version, stores: {} };

        await new Promise<void>((resolve, reject) => {
            const openReq = indexedDB.open(name);
            openReq.onsuccess = (): void => {
                const db = openReq.result;

                let pending = db.objectStoreNames.length;
                if (pending === 0) {
                    result[name] = dbDump;
                    db.close();
                    resolve();
                }

                for (const storeName of db.objectStoreNames) {
                    const tx = db.transaction(storeName, "readonly");
                    const store = tx.objectStore(storeName);

                    const storeDump: DumpStoreIndexDB = {
                        keyPath: store.keyPath,
                        autoIncrement: store.autoIncrement,
                        indexes: [],
                        records: [],
                    };

                    // Save indexes
                    for (const idxName of store.indexNames) {
                        const index = store.index(idxName);
                        storeDump.indexes.push({
                            name: index.name,
                            keyPath: index.keyPath,
                            unique: index.unique,
                            multiEntry: index.multiEntry,
                        });
                    }


                    // Get keys and values
                    const getAllReq = store.getAll();
                    const getAllKeysReq = store.getAllKeys();

                    getAllReq.onsuccess = (): void => {
                        getAllKeysReq.onsuccess = (): void => {
                            const values = getAllReq.result;
                            const keys = getAllKeysReq.result;

                            storeDump.records = keys.map((k, i) => ({
                                key: k,
                                value: values[i],
                            }));

                            dbDump.stores[storeName] = storeDump;

                            if (--pending === 0) {
                                result[name] = dbDump;
                                db.close();
                                resolve();
                            }
                        };
                        getAllKeysReq.onerror = (): void => reject(getAllKeysReq.error);
                    };
                    getAllReq.onerror = (): void => reject(getAllReq.error);
                }
            };
            openReq.onerror = (): void => reject(openReq.error);
        });
    }

    return result;
}
