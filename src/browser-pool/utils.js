exports.buildCompositeBrowserId = (browserId, version) => (version ? `${browserId}.${version}` : browserId);
