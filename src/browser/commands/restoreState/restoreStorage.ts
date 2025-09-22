export const restoreStorage = (data: Record<string, string>, type: "localStorage" | "sessionStorage"): void => {
    const storage = window[type];
    storage.clear();

    Object.keys(data).forEach(key => {
        storage.setItem(key, data[key]);
    });
};
