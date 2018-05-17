'use strict';

const SetsBuilder = require('gemini-core').SetsBuilder;

const DEFAULT_DIR = require('../package').name;

exports.reveal = (cfgSets, opts) => {
    const {sets, paths, browsers, ignore} = opts;

    return SetsBuilder
        .create(cfgSets, {defaultDir: DEFAULT_DIR})
        .useSets(sets)
        .useFiles(paths)
        .useBrowsers(browsers)
        .build(process.cwd(), {ignore})
        .then((setCollection) => setCollection.groupByBrowser());
};
