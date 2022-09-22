export const buildCompositeBrowserId = (browserId: string, version?: string): string => {
    return version ? `${browserId}.${version}` : browserId;
};
