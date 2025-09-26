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

                    deleteReq.addEventListener("success", () => resolve());
                    deleteReq.addEventListener("error", () => reject(deleteReq.error));
                    deleteReq.addEventListener("blocked", () => resolve());
                });
            }),
        );
    } catch (error) {
        console.error(error);
    }
}
