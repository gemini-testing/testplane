import { DumpIndexDB, DumpStoreIndexDB } from "../saveState/dumpIndexedDB";

import { clearAllIndexedDB } from "./clearAllIndexedDB";

export async function restoreIndexedDB(dump: Record<string, DumpIndexDB>): Promise<void> {
    await clearAllIndexedDB();

    for (const [dbName, dbData] of Object.entries(dump)) {
        const version = dbData.version || 1;
        const stores = dbData.stores || {};

        await new Promise<void>((resolve, reject) => {
            const openReq = indexedDB.open(dbName, version);

            openReq.onupgradeneeded = (): void => {
                const db = openReq.result;

                // Restore stores
                for (const [storeName, storeInfo] of Object.entries(stores)) {
                    const { keyPath, autoIncrement, indexes } = storeInfo as DumpStoreIndexDB;
                    const objectStore = db.createObjectStore(storeName, {
                        keyPath: keyPath ?? undefined,
                        autoIncrement: !!autoIncrement,
                    });

                    for (const idx of indexes) {
                        objectStore.createIndex(idx.name, idx.keyPath, {
                            unique: idx.unique,
                            multiEntry: idx.multiEntry,
                        });
                    }
                }
            };

            openReq.onsuccess = (): void => {
                const db = openReq.result;
                const tx = db.transaction(Object.keys(stores), "readwrite");

                for (const [storeName, storeInfo] of Object.entries(stores)) {
                    const { records } = storeInfo as DumpStoreIndexDB;
                    const store = tx.objectStore(storeName);

                    for (const { key, value } of records) {
                        try {
                            if (store.keyPath) {
                                store.put(value);
                            } else {
                                store.put(value, key as unknown as string);
                            }
                        } catch (e) {
                            console.warn(`Insert error ${storeName}:`, e);
                        }
                    }
                }

                tx.oncomplete = (): void => {
                    db.close();
                    resolve();
                };
                tx.onerror = (): void => reject(tx.error);
            };

            openReq.onerror = (): void => reject(openReq.error);
        });
    }
}
