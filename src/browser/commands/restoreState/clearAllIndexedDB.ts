export async function clearAllIndexedDB(): Promise<void> {
    try {
        if (!("databases" in indexedDB)) {
            throw new Error("Your browser don't indexedDB.databases()");
        }

        const dbList = await indexedDB.databases();

        await Promise.all(
            dbList.map((dbInfo: { name?: string }): Promise<void> => {
                if (!dbInfo.name) {
                    return Promise.resolve();
                }

                return new Promise<void>((resolve, reject) => {
                    const deleteReq = indexedDB.deleteDatabase(dbInfo.name as string);
                    deleteReq.onsuccess = (): void => resolve();
                    deleteReq.onerror = (): void => reject(deleteReq.error);
                    deleteReq.onblocked = (): void => {
                        resolve();
                    };
                });
            }),
        );
    } catch (error) {
        console.error(error);
    }
}
