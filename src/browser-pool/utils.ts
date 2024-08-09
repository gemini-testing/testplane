export const buildCompositeBrowserId = (browserId: string, version?: string): string =>
    version ? `${browserId}.${version}` : browserId;
